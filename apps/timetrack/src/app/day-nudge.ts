import { signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  DEFAULT_NUDGE_SNOOZE_MS,
  DayNudge,
  DayNudgeRecord,
  dayNudge,
  localDayKey,
  localDayRange,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { injectGitCollector } from '../collectors';
import { injectHostPorts } from '../host';
import { injectTimetrackSettings } from './settings/settings';
import { readToday$ } from './read-day';

/** How often the day is asked whether it is finished. The reminder is due to the minute, not sooner. */
const NUDGE_INTERVAL_MS = 60_000;

/**
 * The one reminder that today is not finished, on the two surfaces that can carry it.
 *
 * Closing the window hides it to the tray, so the banner alone would remind nobody — the desktop
 * notification is what reaches a user who is already halfway out of the door. Both say the same
 * sentence, because the core words it once.
 */
const DAY_NUDGE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const git = injectGitCollector();
  const settings = injectTimetrackSettings();
  const pending = signal<DayNudge | null>(null);
  const silences$ = new Subject<Date>();

  const read$ = (): Observable<DayNudge | null> => {
    const current = settings.settings();

    if (!current.nudge.enabled) return of(null);

    return readToday$({ ports, settings: current, repoRoots: git.discovery()?.repos ?? [] }).pipe(
      switchMap(({ key, review }) =>
        combineLatest({
          ledger: ports.ledger.entriesForDay$(key),
          record: ports.nudge.recordFor$(key),
        }).pipe(
          map(({ ledger, record }) =>
            dayNudge({
              day: key,
              review,
              ledger,
              record,
              now: new Date(),
              atMinute: current.nudge.atMinute,
            }),
          ),
        ),
      ),
    );
  };

  /**
   * The record is written before the notification is sent, not after.
   *
   * A write that failed would otherwise leave the day looking un-reminded, and the next tick would
   * send the same notification a minute later, and every minute after that.
   */
  const announce$ = (nudge: DayNudge): Observable<unknown> =>
    ports.nudge
      .save$({ day: nudge.day, lastNudgedAt: new Date(), silencedUntil: null })
      .pipe(concatMap(() => ports.nudge.notify$({ title: nudge.title, body: nudge.body })));

  merge(toObservable(settings.settings), timer(0, NUDGE_INTERVAL_MS))
    .pipe(
      concatMap(() => read$().pipe(catchError(() => EMPTY))),
      concatMap((next) => {
        pending.set(next);

        return next?.notify ? announce$(next).pipe(catchError(() => EMPTY)) : EMPTY;
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  silences$
    .pipe(
      concatMap((until) => {
        const record: DayNudgeRecord = {
          day: pending()?.day ?? localDayKey(new Date()),
          lastNudgedAt: new Date(),
          silencedUntil: until,
        };

        pending.set(null);

        return ports.nudge.save$(record).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    /** What today still owes, once the reminder is due. `null` while the day is finished or quiet. */
    pending: pending.asReadonly(),

    later: () => silences$.next(new Date(Date.now() + DEFAULT_NUDGE_SNOOZE_MS)),
    notToday: () => silences$.next(localDayRange(localDayKey(new Date())).to),

    /** Puts one on screen now, so the user can see whether this desktop shows them at all. */
    sendTest$: () =>
      ports.nudge.notify$({
        title: 'Timetrack reminders are on',
        body: 'This is what the end-of-day reminder will look like.',
      }),
  };
});

export const injectDayNudge = /* @__PURE__ */ toInjectFn(DAY_NUDGE_DEF);
