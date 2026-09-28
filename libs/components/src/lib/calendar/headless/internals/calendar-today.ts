import { isPlatformBrowser } from '@angular/common';
import { NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addDays, startOfDay } from 'date-fns';
import { defer, repeat, tap, timer } from 'rxjs';

const MIN_REFRESH_DELAY_MS = 1000;

/** Today at midnight, advancing when the day changes. */
export const injectCalendarToday = () => {
  const today = signal(startOfDay(new Date()));

  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return today.asReadonly();
  }

  const refresh$ = defer(() => timer(Math.max(MIN_REFRESH_DELAY_MS, addDays(today(), 1).getTime() - Date.now()))).pipe(
    tap(() => today.set(startOfDay(new Date()))),
    repeat(),
    takeUntilDestroyed(),
  );

  // Outside the zone, or a day-long pending timer keeps a zone-based app from ever becoming stable.
  inject(NgZone).runOutsideAngular(() => refresh$.subscribe());

  return today.asReadonly();
};
