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

/** One line per process, highest CPU first: its CPU share, pid, command and checkout (`?` when unknown). */
export const topProcessLinesOf = (processes, count = TOP_PROCESSES) =>
  [...processes]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, count)
    .map(({ pid, cpu, command, cwd }) => `  ${cpu.toFixed(1).padStart(5)} % cpu  ${pid}  ${command}  in ${cwd ?? '?'}`);

/** Parses `ps -A -o pid=,pcpu=,args=` output into `{ pid, cpu, command }` rows. */
export const psRowsOf = (output) =>
  output
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+([\d.]+)\s+(.+)$/))
    .filter(Boolean)
    .map(([, pid, cpu, command]) => ({
      pid: Number(pid),
      cpu: Number(cpu),
      command: command.slice(0, COMMAND_LENGTH),
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

const sampledCpu = () => {
  try {
    const before = procTicks();

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SAMPLE_MS);

    return cpuDeltaOf({ before, after: procTicks(), seconds: SAMPLE_MS / 1000 });
  } catch {
    return null;
  }
};

/**
 * The top processes by CPU on this machine, with their checkout on Linux; empty when `ps` fails. On Linux the CPU share
 * is measured over one second; elsewhere it is the `ps` average over the life of the process.
 */
export const topProcesses = () => {
  try {
    const sampled = sampledCpu();
    const rows = psRowsOf(execFileSync('ps', ['-A', '-o', 'pid=,pcpu=,args='], { encoding: 'utf8' }));
    const measured = sampled
      ? rows.filter((row) => sampled.has(row.pid)).map((row) => ({ ...row, cpu: sampled.get(row.pid) }))
      : rows;

    return topProcessLinesOf(measured.map((row) => ({ ...row, cwd: cwdOf(row.pid) })));
  } catch {
    return [];
  }
};
