import { execFileSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';

const TOP_PROCESSES = 5;
const COMMAND_LENGTH = 80;

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

/** The top processes by CPU on this machine, with their checkout on Linux; empty when `ps` fails. */
export const topProcesses = () => {
  try {
    const rows = psRowsOf(execFileSync('ps', ['-A', '-o', 'pid=,pcpu=,args='], { encoding: 'utf8' }));

    return topProcessLinesOf(rows.map((row) => ({ ...row, cwd: cwdOf(row.pid) })));
  } catch {
    return [];
  }
};
