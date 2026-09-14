import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';

const MINUTE_MS = 60 * 1000;

/**
 * The current time, re-read on every minute boundary. The first tick waits out the remainder of the
 * current minute rather than a whole one, so the signal changes when the clock does.
 *
 * @internal
 */
export const injectSchedulerClock = (): Signal<Date> => {
  const start = new Date();

  return toSignal(timer(MINUTE_MS - (start.getTime() % MINUTE_MS), MINUTE_MS).pipe(map(() => new Date())), {
    initialValue: start,
  });
};
