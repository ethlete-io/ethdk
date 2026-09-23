import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, expand, of, skip, switchMap, timer } from 'rxjs';

export type CountdownDeadline = Date | string | number | null | undefined;

export type Countdown = {
  /** Whole seconds left, rounded up - `0` once the deadline has passed. */
  totalSeconds: number;
  days: number;
  /** `0` - `23` */
  hours: number;
  /** `0` - `59` */
  minutes: number;
  /** `0` - `59` */
  seconds: number;
  hasPassed: boolean;
};

const SECOND_MS = 1000;

const toTimestamp = (deadline: CountdownDeadline) => {
  if (deadline === null || deadline === undefined || deadline === '') return null;

  const timestamp = new Date(deadline).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
};

const toCountdown = (remainingMs: number): Countdown => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND_MS));

  return {
    totalSeconds,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    hasPassed: totalSeconds === 0,
  };
};

/**
 * The time left until `deadline`, recounted on every whole second and broken down into days, hours, minutes
 * and seconds. `null` while the deadline is missing or not a valid date. The timer stops once the deadline
 * has passed, and never runs on the server.
 *
 * Call in an injection context.
 *
 * ```ts
 * protected timeLeft = signalCountdown(computed(() => this.round()?.startsAt));
 * ```
 */
export const signalCountdown = (deadline: () => CountdownDeadline): Signal<Countdown | null> => {
  const end = computed(() => toTimestamp(deadline()));
  const tick = signal(0);

  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    toObservable(end)
      .pipe(
        switchMap((endsAt) => {
          if (endsAt === null) return EMPTY;

          return of(null).pipe(
            expand(() => {
              const remainingMs = endsAt - Date.now();

              return remainingMs <= 0 ? EMPTY : timer(remainingMs % SECOND_MS || SECOND_MS);
            }),
            skip(1),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => tick.update((count) => count + 1));
  }

  return computed(() => {
    tick();

    const endsAt = end();

    return endsAt === null ? null : toCountdown(endsAt - Date.now());
  });
};
