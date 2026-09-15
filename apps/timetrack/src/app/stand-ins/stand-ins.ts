import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { ReviewedRow, StandIn, StandInAge, canReopenStandIn, standInAge, standInHeldMs } from '@ethlete/timetrack';
import { catchError, combineLatest, forkJoin, map, of, switchMap, tap, timer } from 'rxjs';
import { injectGitCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * How often the age is read again. An age is counted in workdays, so once an hour is far more often
 * than it can change, and the alternative is a stand-in that only turns overdue when something else
 * on the screen happens to change.
 */
const AGE_TICK_MS = 3_600_000;

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
                ports.ledger.entriesForDay$(day).pipe(
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

  const heldProbe = computed(() => ({
    days: daysToTotal(),
    settings: settings.settings(),
    repoRoots: git.discovery()?.repos ?? [],
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
                readDay$({ ports, settings: probe.settings, repoRoots: probe.repoRoots, day }).pipe(
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
    const limits = settings.settings().standIn;
    const at = now();

    return new Map<string, StandInAge>(
      standIns().map((standIn) => [
        standIn.id,
        standInAge({
          standIn,
          heldMs: standInHeldMs({ id: standIn.id, rows }),
          now: at,
          overdueAfterWorkdays: limits.overdueAfterWorkdays,
          overdueAfterMs: limits.overdueAfterMs,
        }),
      ]),
    );
  });

  return {
    standIns,
    open,
    /** How long each one has waited, by id. The list reads it, and marks the ones past a limit. */
    ages,
    syncedDays,
    canReopen: (standIn: StandIn) => canReopenStandIn({ standIn, syncedDays: syncedDays() }),

    /**
     * Names the issue the work turned out to be. Every rule that pointed at the stand-in takes the key,
     * so every band on every day it held follows without a stored day being rewritten.
     */
    resolve: (options: { id: string; issueKey: string }) => {
      const issueKey = options.issueKey.trim().toUpperCase();

      if (!issueKey) return;

      settings.resolveStandIn({ id: options.id, issueKey });
    },

    reopen: (id: string) => settings.reopenStandIn(id),

    /** Puts the bands back to unnamed on every day the stand-in held, and takes its rules with it. */
    remove: (id: string) => settings.removeStandIn(id),
  };
});

export const injectStandIns = /* @__PURE__ */ toInjectFn(STAND_INS_DEF);
