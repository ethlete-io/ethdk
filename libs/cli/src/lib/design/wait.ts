import { firstValueFrom, from, race, switchMap, tap, throwError, timer } from 'rxjs';

export class WaitTimeoutError extends Error {}

export const durationOf = (ms: number) =>
  ms >= 120_000 ? `${Math.round(ms / 60_000)} min` : ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;

/**
 * Resolves with `work`, or rejects with a `WaitTimeoutError` naming `what` once `ms` passed. With `announceAfterMs`,
 * writes a line naming `what` to stderr when the wait lasts that long.
 */
export const withinLimit = <T>(
  work: Promise<T>,
  options: { ms: number; what: string; announceAfterMs?: number; announce?: (line: string) => void },
): Promise<T> => {
  const { ms, what, announceAfterMs } = options;
  const announce = options.announce ?? ((line: string) => process.stderr.write(`${line}\n`));
  const announcing =
    announceAfterMs !== undefined && announceAfterMs < ms
      ? timer(announceAfterMs)
          .pipe(tap(() => announce(`waiting for ${what} (up to ${durationOf(ms)})`)))
          .subscribe()
      : null;
  const limit$ = timer(ms).pipe(
    switchMap(() => throwError(() => new WaitTimeoutError(`timed out after ${durationOf(ms)} waiting for ${what}`))),
  );

  return firstValueFrom(race(from(work), limit$)).finally(() => announcing?.unsubscribe());
};

/** A Playwright `timeout` for `ms`: Playwright reads 0 as no limit at all, so a spent budget becomes 1 ms. */
export const playwrightTimeoutOf = (ms: number) => Math.max(Math.ceil(ms), 1);
