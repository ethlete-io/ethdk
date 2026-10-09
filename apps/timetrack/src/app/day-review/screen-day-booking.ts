import { computed } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, catchError, concatMap, distinctUntilChanged, filter } from 'rxjs';
import { injectAgentDay } from '../agent/agent-day';
import { injectDayReview } from './day-review';

/** Books the day on screen once it is frozen and has no stored review yet. See ADR 0040. */
const SCREEN_DAY_BOOKING_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const dayReview = injectDayReview();
  const agentDay = injectAgentDay();

  const unbookedDay = computed(() => {
    const edits = dayReview.storedEdits();

    return edits?.frozenRows && !edits.booked ? dayReview.dayKey() : null;
  });

  toObservable(unbookedDay)
    .pipe(
      distinctUntilChanged(),
      filter((day): day is string => day !== null),
      concatMap((day) => agentDay.book$(day).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {};
});

export const injectScreenDayBooking = /* @__PURE__ */ toInjectFn(SCREEN_DAY_BOOKING_DEF);
