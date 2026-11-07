import { spawnSync } from 'child_process';
import { readdirSync, readFileSync, readlinkSync } from 'fs';
import { sep } from 'path';

export type RunningProcess = { args: string[]; cwd: string | null };

const readProcFs = (): RunningProcess[] =>
  readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .flatMap((pid) => {
      try {
        const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);

        return [{ args, cwd: readlinkSync(`/proc/${pid}/cwd`) }];
      } catch {
        return [];
      }
    });

const readPs = (): RunningProcess[] => {
  const result = spawnSync('ps', ['-axo', 'args='], { encoding: 'utf8' });

  return result.status === 0
    ? result.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ args: line.trim().split(/\s+/), cwd: null }))
    : [];
};

const realProcesses = (): RunningProcess[] => {
  try {
    return readProcFs();
  } catch {
    return readPs();
  }
};

const isNxBuildOf = (process: RunningProcess, name: string) => {
  const nx = process.args.findIndex((arg) => /(^|[\\/])nx(\.js)?$/.test(arg));

  return nx !== -1 && process.args[nx + 1] === 'build' && process.args[nx + 2] === name;
};

/**
 * Whether an `nx build <name>` runs for the build folder `dir`. A process with a known working folder counts only
 * when `dir` lies inside it, so a build in a sibling worktree does not.
 */
export const isBuildRunning = (options: { dir: string; name: string; processes?: () => RunningProcess[] }) => {
  const { dir, name, processes = realProcesses } = options;

  return processes().some(
    (running) =>
      isNxBuildOf(running, name) && (running.cwd === null || dir === running.cwd || dir.startsWith(running.cwd + sep)),
  );
};
