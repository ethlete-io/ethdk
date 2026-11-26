import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { injectAgentDay } from '../agent/agent-day';
import { injectDayReview } from '../day-review/day-review';
import { sendSavedDays$ } from './day-rows';

const DAY_ROWS_ON_SAVE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const review = injectDayReview();
  const agentDay = injectAgentDay();

  sendSavedDays$({ saved$: review.saved$, openDay: review.dayKey, send$: agentDay.sendDayRows$ })
    .pipe(takeUntilDestroyed())
    .subscribe();

  return {};
});

export const injectDayRowsOnSave = /* @__PURE__ */ toInjectFn(DAY_ROWS_ON_SAVE_DEF);
