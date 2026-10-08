import { Provider, Type } from '@angular/core';
import { SchedulerEditSurfaceComponent } from './scheduler-edit-surface.component';
import {
  defineSchedulerAddOverlay,
  defineSchedulerEditOverlay,
  SCHEDULER_EDIT_SURFACE,
} from './scheduler-edit-surface-overlays';

export type SchedulerEditSurfaceOptions = {
  /**
   * The edit surface component to open. It applies `SchedulerEditSurfaceDirective` through
   * `hostDirectives` with the `appointment` and `appointments` inputs.
   * @default SchedulerEditSurfaceComponent
   */
  component?: Type<object>;
};

/**
 * Registers the edit surface for schedulers and `injectSchedulerEditSurfaceOpener()` in this
 * injector's subtree - the default `<et-scheduler-edit-surface>`, or `component`.
 */
export const provideSchedulerEditSurface = (options: SchedulerEditSurfaceOptions = {}): Provider => {
  const component = options.component ?? SchedulerEditSurfaceComponent;

  return {
    provide: SCHEDULER_EDIT_SURFACE,
    useValue: {
      editOverlay: defineSchedulerEditOverlay(component),
      addOverlay: defineSchedulerAddOverlay(component),
    },
  };
};
