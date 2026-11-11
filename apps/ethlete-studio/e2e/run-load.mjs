import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';

const TOP_PROCESSES = 5;
const COMMAND_LENGTH = 80;
const SAMPLE_MS = 1000;
const TICKS_PER_SECOND = 100;

/** True when the one-minute load at the start or the end of a run is above the cores. */
export const isNoisy = ({ start, end, cores }) => Math.max(start, end) > cores;

/**
 * The closing line of an e2e run: the machine, the one-minute load at its start and end, the cores and the workers,
 * and "noisy" when either load is above the cores.
 */
export const runLoadLineOf = ({ start, end, cores, workers, machine }) =>
  `load ${start.toFixed(1)} at start, ${end.toFixed(1)} at end on ${machine}, ${cores} cores, ${workers} worker(s)${isNoisy({ start, end, cores }) ? ' - noisy, not a measurement' : ''}`;

export const GOAL_MS = 90_000;
export const GOAL_MACHINE = 'tank';

/**
 * The 90 s goal line of a full e2e run (ADR 0240): it counts on the desk PC (`GOAL_MACHINE`, or
 * `STUDIO_E2E_GOAL_MACHINE`); every other machine reports its time only. A noisy run is no measurement.
 */
export const goalLineOf = ({ ms, machine, noisy, goalMachine = GOAL_MACHINE }) => {
  const time = `${Math.round(ms / 1000)} s`;
  if (machine !== goalMachine)
    return `goal: ${time} on ${machine}, reported only (the ${GOAL_MS / 1000} s goal counts on ${goalMachine})`;
  if (noisy) return `goal: ${time} on ${machine}, noisy, not a measurement of the ${GOAL_MS / 1000} s goal`;

  return `goal: ${time} on ${machine}, ${ms <= GOAL_MS ? 'within' : 'over'} the ${GOAL_MS / 1000} s goal`;
};

/** One line per process, highest CPU first: its CPU share, pid, command and checkout (`?` when unknown). */
export const topProcessLinesOf = (processes, count = TOP_PROCESSES) =>
  [...processes]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, count)
    .map(({ pid, cpu, command, cwd }) => `  ${cpu.toFixed(1).padStart(5)} % cpu  ${pid}  ${command}  in ${cwd ?? '?'}`);

/** Parses `ps -A -o pid=,pcpu=,args=` output into `{ pid, cpu, command }` rows. */
export const psRowsOf = (output, commandLength = COMMAND_LENGTH) =>
  output
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+([\d.]+)\s+(.+)$/))
    .filter(Boolean)
    .map(([, pid, cpu, command]) => ({
      pid: Number(pid),
      cpu: Number(cpu),
      command: command.slice(0, commandLength),
    }));

const cwdOf = (pid) => {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
};

/** The user and system CPU time in clock ticks from the text of `/proc/<pid>/stat`. */
export const cpuTicksOf = (stat) => {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

  return Number(fields[11]) + Number(fields[12]);
};

/** The CPU share in percent of each process that ran between two tick samples taken `seconds` apart. */
export const cpuDeltaOf = ({ before, after, seconds, ticksPerSecond = TICKS_PER_SECOND }) =>
  new Map(
    [...after]
      .filter(([pid, ticks]) => before.has(pid) && ticks > before.get(pid))
      .map(([pid, ticks]) => [pid, ((ticks - before.get(pid)) / ticksPerSecond / seconds) * 100]),
  );

const procTicks = () =>
  new Map(
    readdirSync('/proc')
      .filter((name) => /^\d+$/.test(name))
      .flatMap((name) => {
        try {
          return [[Number(name), cpuTicksOf(readFileSync(`/proc/${name}/stat`, 'utf8'))]];
        } catch {
          return [];
        }
      }),
  );

/** Parses `ps -A -o pid=,time=` output into the CPU time of each process in hundredths of a second. */
export const psTicksOf = (output) =>
  new Map(
    output
      .split('\n')
      .map((line) => line.trim().match(/^(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\.(\d+)$/))
      .filter(Boolean)
      .map(([, pid, days = '0', hours = '0', minutes, seconds, fraction]) => [
        Number(pid),
        ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 6000 +
          Number(seconds) * 100 +
          Number(fraction.padEnd(2, '0').slice(0, 2)),
      ]),
  );

const psTicks = () => psTicksOf(execFileSync('ps', ['-A', '-o', 'pid=,time='], { encoding: 'utf8' }));

const sampledCpu = () => {
  const ticks = process.platform === 'darwin' ? psTicks : procTicks;

  try {
    const before = ticks();

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SAMPLE_MS);

    return cpuDeltaOf({ before, after: ticks(), seconds: SAMPLE_MS / 1000 });
  } catch {
    return null;
  }
};

const parentOf = (pid) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');

    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  } catch {
    return null;
  }
};

/**
 * Every process with its pid, parent pid, CPU share, short `command`, full `args` and checkout (`cwd`, null when unknown); empty when `ps`
 * fails. On Linux and macOS the CPU share is measured over one second and a process that did not run is left out; elsewhere
 * it is the `ps` average over the life of the process.
 */
export const processList = () => {
  try {
    const sampled = sampledCpu();
    const rows = psRowsOf(execFileSync('ps', ['-A', '-o', 'pid=,pcpu=,args='], { encoding: 'utf8' }), Infinity);
    const measured = sampled
      ? rows.filter((row) => sampled.has(row.pid)).map((row) => ({ ...row, cpu: sampled.get(row.pid) }))
      : rows;

    return measured.map((row) => ({
      ...row,
      args: row.command,
      command: row.command.slice(0, COMMAND_LENGTH),
      ppid: parentOf(row.pid),
      cwd: cwdOf(row.pid),
    }));
  } catch {
    return [];
  }
};

/** The top processes by CPU on this machine, with their checkout on Linux; empty when `ps` fails. */
export const topProcesses = () => topProcessLinesOf(processList());
