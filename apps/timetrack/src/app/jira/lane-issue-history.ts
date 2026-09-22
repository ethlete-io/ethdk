import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  LaneIssueUse,
  dayBoundaryOf,
  laneIssueUses,
  laneIssueUsesFor,
  localDayKey,
  shiftDayKey,
} from '@ethlete/timetrack';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * How far back a lane's namings are read.
 *
 * Long enough that a fortnight away from a checkout does not empty its list, and short enough that
 * the ticket of a sprint two quarters ago has dropped off it.
 */
export const LANE_ISSUE_WINDOW_DAYS = 60;

/** At most this many issues are offered per lane, so the group stays a short-cut and not a second list. */
export const LANE_ISSUE_LIMIT = 6;

/**
 * Which issues each lane of the day screen was named with before.
 *
 * One read for the whole window: the days are read once, ranked once, and every picker on the screen
 * shares the answer. Nothing is read until a picker asks, because a day that is never reviewed must
 * not pay for it.
 *
 * A failed read is an empty list rather than an error. The group this feeds is a short-cut beside a
 * picker that works without it, and a store that would not answer is not worth a message here.
 */
const LANE_ISSUE_HISTORY_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();

  const reads$ = new Subject<void>();

  // `switchMap`: a re-read after a naming replaces whatever was still in flight, and the pickers
  // that all ask on their first open want the one answer rather than one read each.
  const uses = toSignal<LaneIssueUse[] | null>(
    reads$.pipe(
      switchMap(() => {
        const today = localDayKey(new Date(), dayBoundaryOf(settings.settings()));

        return ports.review.editsBetween$(shiftDayKey(today, -LANE_ISSUE_WINDOW_DAYS), today).pipe(
          map((days) => laneIssueUses(days)),
          catchError(() => of<LaneIssueUse[]>([])),
        );
      }),
    ),
    { initialValue: null },
  );

  return {
    /** Reads the window once. Every picker may ask on every open; only the first one reads. */
    load: () => {
      if (uses() === null) reads$.next();
    },
    /**
     * Reads it again, after a row was named. A day being reviewed now is inside the window, so the
     * issue just picked for one call is what the next call of the same day should be offered.
     */
    reload: () => reads$.next(),
    /** The issues one lane was named with, most recently named first. Empty until the read lands. */
    usesFor: (laneKey: string) => laneIssueUsesFor({ uses: uses() ?? [], laneKey, limit: LANE_ISSUE_LIMIT }),
    /** Every remembered key, so their summaries can be read in one call rather than one per lane. */
    keys: computed(() => [...new Set((uses() ?? []).map((use) => use.issueKey))]),
  };
});

export const injectLaneIssueHistory = /* @__PURE__ */ toInjectFn(LANE_ISSUE_HISTORY_DEF);
