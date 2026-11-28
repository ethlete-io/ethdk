import { firstValueFrom, from, fromEvent, race, switchMap, throwError } from 'rxjs';

export class RunAbortedError extends Error {
  constructor() {
    super('design-explore: the run was aborted, its client closed the connection');
  }
}

let current: AbortSignal | null = null;

/** Runs `run` as the design run `signal` aborts; draws asked during it stop when it does. Runs never overlap. */
export const withRunSignal = async <T>(signal: AbortSignal | undefined, run: () => Promise<T>) => {
  const outer = current;

  current = signal ?? null;

  try {
    return await run();
  } finally {
    current = outer;
  }
};

/** The abort signal of the design run in progress, or `null`. */
export const runSignal = () => current;

/** Settles like `work`, or rejects with a `RunAbortedError` as soon as `signal` aborts. */
export const unlessAborted = <T>(signal: AbortSignal | null, work: Promise<T>) => {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(new RunAbortedError());

  return firstValueFrom(
    race(from(work), fromEvent(signal, 'abort').pipe(switchMap(() => throwError(() => new RunAbortedError())))),
  );
};
