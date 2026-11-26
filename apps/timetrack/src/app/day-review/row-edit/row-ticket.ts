import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { createOverlayOpener } from '@ethlete/components';
import { injectAutoMode } from '../auto-mode';
import { DAY_DEBUG_OVERLAY } from '../day-debug.component';
import { injectDayReview } from '../day-review';
import { injectTicketDraft } from '../ticket-draft';
import { RowTicketFiling, rowTicketFiling } from './row-ticket-filing';

/** Files a ticket for a not yet named band in the same form the Debug dialog holds, opened on that context. */
export const injectRowTicket = (): RowTicketFiling => {
  const store = injectDayReview();
  const autoMode = injectAutoMode();
  const tickets = injectTicketDraft();
  const debug = runInInjectionContext(inject(EnvironmentInjector), () => createOverlayOpener(DAY_DEBUG_OVERLAY));

  return rowTicketFiling({
    store,
    autoMode,
    open: (context) => {
      tickets.open(context);
      debug.open();
    },
  });
};
