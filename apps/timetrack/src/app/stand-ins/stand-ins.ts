import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ReviewedRow,
  StandIn,
  StandInAge,
  canReopenStandIn,
  dayBoundaryOf,
  isDayHeldByTempo,
  isStandInBooked,
  isStandInHidden,
  isStandInStale,
  localDayKey,
  standInAge,
  standInHeldMs,
  standInWaitingDays,
  standInWorklogOffers,
  WriteSource,
  ledgerEntriesForRange$,
} from '@ethlete/timetrack';
import { catchError, combineLatest, forkJoin, map, of, switchMap, tap, timer } from 'rxjs';
import { injectGitCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';
import { injectCheckoutDependencies } from '../checkout-dependencies';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectProjectLinks } from '../project-links';

/**
 * How often the age is read again. An age is counted in workdays, so once an hour is far more often
 * than it can change, and the alternative is a stand-in that only turns overdue when something else
 * on the screen happens to change.
 */
const AGE_TICK_MS = 3_600_000;

const STALE_AFTER_WORKDAYS = 10;

/**
 * Every stand-in the settings hold, and the three acts that end one.
 *
 * This is not a question about a day, so it does not live on the day store: a stand-in takes bands
 * across days and across checkouts, and what still waits on a ticket is asked of the whole record.
 */
const STAND_INS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const settings = injectTimetrackSettings();
  const ports = injectHostPorts();
  const git = injectGitCollector();
  const dependencies = injectCheckoutDependencies();
  const projectLinks = injectProjectLinks();
  const tempoHistory = injectRecurringPatterns();
  const now = signal(new Date());

  timer(AGE_TICK_MS, AGE_TICK_MS)
    .pipe(
      tap(() => now.set(new Date())),
      takeUntilDestroyed(),
    )
    .subscribe();

  const standIns = computed(() =>
    [...settings.settings().standIns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );

  const open = computed(() => standIns().filter((standIn) => standIn.state === 'open'));

  /**
   * The days a resolved stand-in covers, which are the only ones an undo has to ask about. An open one
   * has nothing to undo, so reading its days would be a ledger call per day for no answer.
   */
  const daysToCheck = computed(() =>
    [
      ...new Set(
        standIns()
          .filter((standIn) => standIn.state === 'resolved')
          .flatMap((standIn) => standIn.days),
      ),
    ].sort(),
  );

  const syncedDays = toSignal(
    toObservable(daysToCheck).pipe(
      switchMap((days) =>
        days.length
          ? forkJoin(
              days.map((day) =>
                ledgerEntriesForRange$({
                  ledger: ports.ledger,
                  day: day,
                  boundary: dayBoundaryOf(settings.settings()),
                }).pipe(
                  map((entries) => (entries.length ? day : null)),
                  catchError(() => of(null)),
                ),
              ),
            ).pipe(map((answers) => answers.filter((day): day is string => !!day)))
          : of<string[]>([]),
      ),
    ),
    { initialValue: [] as string[] },
  );

  /** The days an open stand-in holds bands on, which is the only work the held time has to total. */
  const daysToTotal = computed(() => [...new Set(open().flatMap((standIn) => standIn.days))].sort());

  /**
   * The days an open stand-in holds that Tempo already holds work on: written by this app, or read
   * from Tempo when the day was last opened. The stored coverage is read, not Tempo itself, so the list
   * costs no network call per day.
   */
  const bookedDays = toSignal(
    toObservable(daysToTotal).pipe(
      switchMap((days) =>
        days.length
          ? forkJoin(
              days.map((day) =>
                forkJoin({
                  ledger: ledgerEntriesForRange$({
                    ledger: ports.ledger,
                    day: day,
                    boundary: dayBoundaryOf(settings.settings()),
                  }).pipe(catchError(() => of([]))),
                  coverage: ports.coverage.forDay$(day).pipe(catchError(() => of(null))),
                }).pipe(map(({ ledger, coverage }) => (isDayHeldByTempo({ ledger, coverage }) ? day : null))),
              ),
            ).pipe(map((answers) => new Set(answers.filter((day): day is string => !!day))))
          : of(new Set<string>()),
      ),
    ),
    { initialValue: new Set<string>() },
  );

  const heldProbe = computed(() => ({
    days: daysToTotal().filter((day) => !bookedDays().has(day)),
    settings: settings.settings(),
    repoRoots: git.discovery()?.repos ?? [],
    links: projectLinks(),
    worktrees: git.worktrees(),
    dependencies: dependencies(),
  }));

  /**
   * The rows of every day an open stand-in covers, read on demand rather than stored.
   *
   * A running total on the record would be a second answer to a question the day already answers, and
   * the two would disagree the moment a band was re-cut or a rule was changed.
   */
  const heldRows = toSignal(
    toObservable(heldProbe).pipe(
      switchMap((probe) =>
        probe.days.length
          ? combineLatest(
              probe.days.map((day) =>
                readDay$({
                  ports,
                  settings: probe.settings,
                  repoRoots: probe.repoRoots,
                  links: probe.links,
                  worktrees: probe.worktrees,
                  dependencies: probe.dependencies,
                  day,
                }).pipe(
                  map((read) => read.review.rows),
                  catchError(() => of<ReviewedRow[]>([])),
                ),
              ),
            ).pipe(map((days) => days.flat()))
          : of<ReviewedRow[]>([]),
      ),
    ),
    { initialValue: [] as ReviewedRow[] },
  );

  const ages = computed(() => {
    const rows = heldRows();
    const booked = bookedDays();
    const limits = settings.settings().standIn;
    const at = now();

    return new Map<string, StandInAge>(
      standIns().map((standIn) => [
        standIn.id,
        standInAge({
          standIn,
          bookedDays: booked,
          heldMs: standInHeldMs({ id: standIn.id, rows }),
          now: at,
          overdueAfterWorkdays: limits.overdueAfterWorkdays,
          overdueAfterMs: limits.overdueAfterMs,
        }),
      ]),
    );
  });

  const booked = computed(() => {
    const days = bookedDays();

    return new Set(
      open()
        .filter((standIn) => isStandInBooked({ standIn, bookedDays: days }))
        .map((standIn) => standIn.id),
    );
  });

  const hidden = computed(
    () =>
      new Set(
        standIns()
          .filter(isStandInHidden)
          .map((standIn) => standIn.id),
      ),
  );

  const stale = computed(() => {
    const at = now();

    return new Set(
      open()
        .filter((standIn) => isStandInStale({ standIn, now: at, afterWorkdays: STALE_AFTER_WORKDAYS }))
        .map((standIn) => standIn.id),
    );
  });

  const worklogOffers = computed(() => standInWorklogOffers({ standIns: open(), worklogs: tempoHistory.worklogs() }));

  const hide = (ids: readonly string[]) =>
    settings.setStandInsHidden(ids, localDayKey(new Date(), dayBoundaryOf(settings.settings())));

  return {
    standIns,
    open,
    /** The ids of the stand-ins the user hid, which the list shows apart and the pickers leave out. */
    hidden,
    /** The ids of the open stand-ins that took no band for a while. */
    stale,
    /** The ids of the open stand-ins whose every day is already in Tempo. The list files them as hidden. */
    booked,
    bookedDays,
    /** The issues Tempo booked an open stand-in's name to, by id. The list offers each as a resolve. */
    worklogOffers,
    waitingDays: (standIn: Pick<StandIn, 'days'>) => standInWaitingDays({ standIn, bookedDays: bookedDays() }),
    hide: (id: string) => hide([id]),
    show: (id: string) => settings.setStandInsHidden([id], ''),
    hideStale: () => hide([...stale()].filter((id) => !hidden().has(id))),
    /** How long each one has waited, by id. The list reads it, and marks the ones past a limit. */
    ages,
    syncedDays,
    canReopen: (standIn: StandIn) => canReopenStandIn({ standIn, syncedDays: syncedDays() }),

    /**
     * Names the issue the work turned out to be. Every rule that pointed at the stand-in takes the key,
     * so its bands on every day Tempo does not hold yet follow without a stored day being rewritten.
     */
    resolve: (options: { id: string; issueKey: string; source?: WriteSource }) => {
      const issueKey = options.issueKey.trim().toUpperCase();

      if (!issueKey) return;

      settings.resolveStandIn({ ...options, issueKey, bookedDays: bookedDays() });
    },

    setIssue: (options: { id: string; issueKey: string }) =>
      settings.setStandInIssue({ ...options, bookedDays: bookedDays() }),

    resolveKeyedByHand: (rows: Parameters<typeof settings.resolveStandInsKeyedByHand>[0]) =>
      settings.resolveStandInsKeyedByHand(rows, bookedDays()),

    reopen: (id: string) => settings.reopenStandIn(id),

    /** Lets auto mode resolve a stand-in the user reopened. */
    handBack: (id: string) => settings.resetStandInResolution(id),

    /** Folds a stand-in into the other open one with its name. */
    merge: (options: { fromId: string; intoId: string }) => settings.mergeStandIn(options),

    /** Puts the bands back to unnamed on every day the stand-in held, and takes its rules with it. */
    remove: (id: string) => settings.removeStandIn(id),
  };
});

export const injectStandIns = /* @__PURE__ */ toInjectFn(STAND_INS_DEF);
