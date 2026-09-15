import { computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { StandIn, canReopenStandIn } from '@ethlete/timetrack';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * Every stand-in the settings hold, and the three acts that end one.
 *
 * This is not a question about a day, so it does not live on the day store: a stand-in takes bands
 * across days and across checkouts, and what still waits on a ticket is asked of the whole record.
 */
const STAND_INS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const settings = injectTimetrackSettings();
  const ports = injectHostPorts();

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

  return {
    standIns,
    open,
    /** What the day screen's own entry counts: the work that still waits on somebody for a ticket. */
    openCount: computed(() => open().length),
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
