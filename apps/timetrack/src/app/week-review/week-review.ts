import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import {
  WeekReview,
  WeekReviewDayInput,
  localDayKey,
  reviewWeek,
  shiftWeekKey,
  startOfWeekKey,
  weekDayKeys,
} from '@ethlete/timetrack';
import { Observable, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { DayReadOptions, readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A week tagged with the week it was asked for, so an answer for the week before is not shown. */
type Loaded = { start: string; value: WeekReview | null; failure: string | null };

/**
 * The week a reviewer catches up in.
 *
 * The end-of-day reminder is only ever about today, on purpose — a machine that was asleep at 17:30
 * has nothing to be told at 03:00. So a day that was missed is missed silently, and this is the only
 * surface that ever says so. It reads every day the same way the reminder reads today, through
 * `dayReviewGap`, so the two can never disagree about which days are finished.
 *
 * Scoped to its view rather than to the root: seven correlations are worth running when somebody is
 * looking at them, and not on every app start.
 */
const WEEK_REVIEW_DEF = /* @__PURE__ */ defineProvider(() => {
  const ports = injectHostPorts();
  const windows = injectWindowCollector();
  const agentSessions = injectAgentSessionCollector();
  const git = injectGitCollector();
  const settings = injectTimetrackSettings();

  const start = signal(startOfWeekKey(localDayKey(new Date())));
  const reload = signal(0);

  const readWeek$ = (options: DayReadOptions & { start: string }): Observable<WeekReview> =>
    combineLatest(
      weekDayKeys(options.start).map((day) =>
        readDay$({ ...options, day }).pipe(
          switchMap(({ review }) =>
            combineLatest({
              ledger: ports.ledger.entriesForDay$(day),
              coverage: ports.coverage.forDay$(day),
            }).pipe(map(({ ledger, coverage }): WeekReviewDayInput => ({ day, review, ledger, coverage }))),
          ),
        ),
      ),
    ).pipe(map((days) => reviewWeek({ days, dayTargetMs: options.settings.dayTargetMs })));

  const probe = computed(() => ({
    start: start(),
    reload: reload(),
    settings: settings.settings(),
    repoRoots: git.discovery()?.repos ?? [],
    windows: windows.lastRun(),
    sessions: agentSessions.lastRun(),
    git: git.lastRun(),
  }));

  const loaded = toSignal(
    toObservable(probe).pipe(
      switchMap((current) =>
        readWeek$({ ports, settings: current.settings, repoRoots: current.repoRoots, start: current.start }).pipe(
          map((value): Loaded => ({ start: current.start, value, failure: null })),
          catchError((error: unknown) => of<Loaded>({ start: current.start, value: null, failure: messageOf(error) })),
        ),
      ),
      startWith(null),
    ),
    { initialValue: null },
  );

  const current = computed(() => {
    const week = loaded();

    return week?.start === start() ? week : null;
  });

  const week = computed(() => current()?.value ?? null);

  return {
    startDay: start.asReadonly(),
    endDay: computed(() => weekDayKeys(start()).at(-1) ?? start()),
    week,
    /** The days still owing something, which is the list this view is for. */
    owing: computed(() => week()?.days.filter((day) => day.gap) ?? []),
    isLoading: computed(() => !current()),
    failure: computed(() => current()?.failure ?? null),
    /** Whether the week under review is the one today falls in. */
    isThisWeek: computed(() => start() === startOfWeekKey(localDayKey(new Date()))),

    shiftWeek: (byWeeks: number) => start.update((day) => shiftWeekKey(day, byWeeks)),
    goToThisWeek: () => start.set(startOfWeekKey(localDayKey(new Date()))),
    recorrelate: () => reload.update((count) => count + 1),
  };
});

export const provideWeekReview = /* @__PURE__ */ toProvideFn(WEEK_REVIEW_DEF);
export const injectWeekReview = /* @__PURE__ */ toInjectFn(WEEK_REVIEW_DEF);
