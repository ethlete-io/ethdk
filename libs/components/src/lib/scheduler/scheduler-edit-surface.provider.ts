import { Provider } from '@angular/core';
import { SCHEDULER_ADD_SURFACE_OVERLAY, SCHEDULER_EDIT_SURFACE_OVERLAY } from './scheduler-edit-surface.component';
import { SCHEDULER_EDIT_SURFACE } from './scheduler-edit-surface.token';

/** Registers the default Scheduler edit surface for schedulers in this injector's subtree. */
export const provideSchedulerEditSurface = (): Provider => ({
  provide: SCHEDULER_EDIT_SURFACE,
  useValue: {
    editOverlay: SCHEDULER_EDIT_SURFACE_OVERLAY,
    addOverlay: SCHEDULER_ADD_SURFACE_OVERLAY,
  },
});
