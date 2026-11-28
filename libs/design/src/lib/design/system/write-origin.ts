import { isAbsolute, relative } from 'node:path';

/** Who wrote a decision file entry (a ready mark or a sketch pick): the actor, the command it ran, and its process id. */
export type WriteOrigin = { by: string; cmd: string; pid: number };

/** A command line for a committed record: an absolute path becomes relative to `cwd`, so no home directory lands in the repo. */
export const portableCmdOf = (args: string[], cwd = process.cwd()) =>
  args.map((arg) => (isAbsolute(arg) ? relative(cwd, arg) || '.' : arg)).join(' ');

/** The origin of a write by `by` from this process; `cmd` defaults to the command line it was started with. */
export const originOf = (by: string, cmd = portableCmdOf(process.argv.slice(2))): WriteOrigin => ({
  by,
  cmd,
  pid: process.pid,
});

/** Whether `origin` names its actor; a decision write without one is refused. */
export const hasActor = (origin: Partial<WriteOrigin> | undefined) =>
  typeof origin?.by === 'string' && origin.by.trim() !== '';
