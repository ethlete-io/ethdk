import { spawnSync } from 'child_process';
import { readdirSync, readFileSync, readlinkSync } from 'fs';
import { sep } from 'path';

export type RunningProcess = { args: string[]; cwd: string | null; task?: NxTask | null };

/** The task an nx task process runs, from its `NX_TASK_TARGET_PROJECT` and `NX_TASK_TARGET_TARGET`. */
export type NxTask = { project: string; target: string };

const taskOf = (pid: string): NxTask | null => {
  const env = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
  const valueOf = (name: string) => env.find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
  const project = valueOf('NX_TASK_TARGET_PROJECT');
  const target = valueOf('NX_TASK_TARGET_TARGET');

  return project && target ? { project, target } : null;
};

const readProcFs = (): RunningProcess[] =>
  readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .flatMap((pid) => {
      try {
        const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);

        return [{ args, cwd: readlinkSync(`/proc/${pid}/cwd`), task: taskOf(pid) }];
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

const projectsOf = (args: string[]) => {
  const flag = args.findIndex((arg) => arg === '-p' || arg === '--projects' || arg.startsWith('--projects='));

  if (flag === -1) return [];

  const value = args[flag]?.startsWith('--projects=') ? args[flag].slice('--projects='.length) : args[flag + 1];

  return (value ?? '').split(',');
};

const isNxBuildOf = (process: RunningProcess, name: string) => {
  if (process.task?.project === name && process.task.target === 'build') return true;

  const nx = process.args.findIndex((arg) => /(^|[\\/])nx(\.js)?$/.test(arg));

  if (nx === -1) return false;

  const [command, ...rest] = process.args.slice(nx + 1);

  if (command === 'build') return rest.includes(name);
  if (command === 'run') return rest[0] === `${name}:build`;

  return command === 'run-many' && projectsOf(rest).includes(name);
};

/**
 * Whether nx builds `<name>` for the build folder `dir`: a task process of its `build` target, also one started as a
 * dependency of another lib's build, or an `nx build`/`nx run`/`nx run-many` command line that names it. A process
 * with a known working folder counts only when `dir` lies inside it, so a build in a sibling worktree does not.
 */
export const isBuildRunning = (options: { dir: string; name: string; processes?: () => RunningProcess[] }) => {
  const { dir, name, processes = realProcesses } = options;

  return processes().some(
    (running) =>
      isNxBuildOf(running, name) && (running.cwd === null || dir === running.cwd || dir.startsWith(running.cwd + sep)),
  );
};
