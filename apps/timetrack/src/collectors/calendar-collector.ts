import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { CalendarOccurrenceEvent, fetchGoogleCalendarEvents$ } from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  exhaustMap,
  from,
  of,
  switchMap,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { injectGoogleAccount } from '../app/google';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';

/**
 * How often the calendar is read again. Meetings are created, moved and cancelled while the day runs,
 * and a quarter of an hour is well inside the window in which any of that still matters.
 */
export const CALENDAR_POLL_INTERVAL_MS = 15 * 60_000;

/** How far each read reaches. Wide enough that yesterday evening and tomorrow morning are both in it. */
export const CALENDAR_WINDOW_BEFORE_MS = 26 * 60 * 60_000;
export const CALENDAR_WINDOW_AFTER_MS = 12 * 60 * 60_000;

export type CalendarCollectorRun = {
  at: Date;
  calendars: number;
  /** Occurrences the read produced, including the ones the store already had. */
  seen: number;
  stored: number;
};

/**
 * Reads the picked calendars into the event store, so a meeting reaches `correlateDay` through the same
 * path as a commit or a focus sample.
 *
 * Every read overlaps the last one by design — a moved meeting is only visible by reading its window
 * again — and `dedupeKeyOf` is what keeps the overlap from storing the same occurrence twice.
 */
const CALENDAR_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const account = injectGoogleAccount();
  const lastRun = signal<CalendarCollectorRun | null>(null);
  const failure = signal<string | null>(null);

  const read$ = (calendarIds: string[]): Observable<unknown> => {
    const at = new Date();

    return account.credentials$().pipe(
      switchMap((credentials) => {
        if (!credentials) return EMPTY;

        return from(calendarIds).pipe(
          concatMap((calendarId) =>
            fetchGoogleCalendarEvents$({
              transport: ports.transport,
              credentials,
              calendarId,
              from: new Date(at.getTime() - CALENDAR_WINDOW_BEFORE_MS),
              to: new Date(at.getTime() + CALENDAR_WINDOW_AFTER_MS),
            }),
          ),
          toArray(),
        );
      }),
      concatMap((perCalendar: CalendarOccurrenceEvent[][]) => {
        const events = perCalendar.flat();

        return ports.events.appendWithCursors$(events, []).pipe(
          tap((stored) => {
            failure.set(null);
            lastRun.set({ at, calendars: calendarIds.length, seen: events.length, stored });
          }),
        );
      }),
    );
  };

  const collect$ = (): Observable<unknown> =>
    defer(() =>
      settings.ready$.pipe(
        concatMap(() => {
          const calendarIds = settings.settings().google.calendarIds;

          return calendarIds.length ? read$(calendarIds) : of(undefined);
        }),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  timer(0, CALENDAR_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => collect$()),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, failure };
});

export const injectCalendarCollector = /* @__PURE__ */ toInjectFn(CALENDAR_COLLECTOR_DEF);
