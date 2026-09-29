import { computed, effect, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { DayReviewEdits } from '@ethlete/timetrack';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectDayReview } from '../day-review/day-review';
import { injectTimetrackSettings } from '../settings/settings';

const keyedRowsOf = (edits: DayReviewEdits | null) =>
  edits ? [...edits.pinned, ...Object.values(edits.overrides)] : [];

/**
 * Resolves an open stand-in once the user keys one of its rows by hand: on the day on screen as the key
 * is picked, and on every stored day an open stand-in holds, so a key picked before this ran counts too.
 */
const STAND_IN_PINS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const dayReview = injectDayReview();

  const openDays = computed(() =>
    [
      ...new Set(
        settings
          .settings()
          .standIns.filter((standIn) => standIn.state === 'open')
          .flatMap((standIn) => standIn.days),
      ),
    ]
      .sort()
      .join(','),
  );

  toObservable(openDays)
    .pipe(
      switchMap((joined) =>
        joined
          ? forkJoin(joined.split(',').map((day) => ports.review.editsFor$(day).pipe(catchError(() => of(null))))).pipe(
              map((stored) => stored.flatMap(keyedRowsOf)),
            )
          : of([]),
      ),
      tap((rows) => settings.resolveStandInsKeyedByHand(rows)),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    if (dayReview.isLoading()) return;

    const rows = dayReview.rows();

    untracked(() => settings.resolveStandInsKeyedByHand(rows));
  });

  return {};
});

export const injectStandInPins = /* @__PURE__ */ toInjectFn(STAND_IN_PINS_DEF);
