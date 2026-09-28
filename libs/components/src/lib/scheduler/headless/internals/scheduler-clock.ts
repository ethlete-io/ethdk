import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { addDays, startOfDay } from 'date-fns';
import { EMPTY, defer, map, repeat, startWith, switchMap, timer } from 'rxjs';

const MINUTE_MS = 60 * 1000;

const minuteBoundaries = () => defer(() => timer(MINUTE_MS - (Date.now() % MINUTE_MS), MINUTE_MS).pipe(startWith(0)));

const dayBoundaries = () =>
  defer(() => timer(startOfDay(addDays(new Date(), 1)).getTime() - Date.now())).pipe(repeat());

/**
 * The current time, re-read on every minute boundary while `enabled` is true. The first tick waits
 * out the remainder of the current minute rather than a whole one, so the signal changes when the
 * clock does. Runs no timer on the server or while disabled.
 *
 * @internal
 */
export const injectSchedulerClock = (enabled: () => boolean): Signal<Date> => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const ticking = computed(() => isBrowser && enabled());

  return toSignal(
    toObservable(ticking).pipe(
      switchMap((isTicking) => (isTicking ? minuteBoundaries() : EMPTY)),
      map(() => new Date()),
    ),
    { initialValue: new Date() },
  );
};

/**
 * The current time, re-read on every local midnight so a day's `today` flag follows the calendar.
 * Runs no timer on the server.
 *
 * @internal
 */
export const injectSchedulerToday = (): Signal<Date> => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  return toSignal(isBrowser ? dayBoundaries().pipe(map(() => new Date())) : EMPTY, { initialValue: new Date() });
};
