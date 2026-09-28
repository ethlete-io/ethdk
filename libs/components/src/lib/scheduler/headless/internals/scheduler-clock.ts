import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, defer, map, startWith, switchMap, timer } from 'rxjs';

const MINUTE_MS = 60 * 1000;

const minuteBoundaries = () => defer(() => timer(MINUTE_MS - (Date.now() % MINUTE_MS), MINUTE_MS).pipe(startWith(0)));

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
