/** Who wrote a decision file entry (a ready mark or a sketch pick): the actor, the command it ran, and its process id. */
export type WriteOrigin = { by: string; cmd: string; pid: number };

/** The origin of a write by `by` from this process; `cmd` defaults to the command line it was started with. */
export const originOf = (by: string, cmd = process.argv.slice(2).join(' ')): WriteOrigin => ({
  by,
  cmd,
  pid: process.pid,
});

/** Whether `origin` names its actor; a decision write without one is refused. */
export const hasActor = (origin: Partial<WriteOrigin> | undefined) =>
  typeof origin?.by === 'string' && origin.by.trim() !== '';
