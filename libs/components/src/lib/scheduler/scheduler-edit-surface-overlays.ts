import { InjectionToken, Type } from '@angular/core';
import {
  buildAnchoredRuntimePositionStrategy,
  defineOverlay,
  injectAnchoredDialogStrategy,
  injectDialogStrategy,
  injectFullscreenDialogStrategy,
  OverlayDefinition,
} from '../overlay';
import { SchedulerEditSurfaceResult } from './scheduler-edit-surface.token';

export type SchedulerEditSurfaceRegistration = {
  editOverlay: OverlayDefinition<object, SchedulerEditSurfaceResult>;
  addOverlay: OverlayDefinition<object, SchedulerEditSurfaceResult>;
};

export const SCHEDULER_EDIT_SURFACE = new InjectionToken<SchedulerEditSurfaceRegistration>('SchedulerEditSurface');

export const defineSchedulerEditOverlay = <TComponent extends object>(component: Type<TComponent>) =>
  defineOverlay<TComponent, SchedulerEditSurfaceResult>({
    component,
    strategies: () => {
      const fullscreenDialogStrategy = injectFullscreenDialogStrategy();
      const anchoredDialogStrategy = injectAnchoredDialogStrategy();

      return [
        { strategy: fullscreenDialogStrategy.build() },
        {
          breakpoint: 'md',
          strategy: anchoredDialogStrategy.build({
            maxWidth: '520px',
            // `minWidth` is also what decides the placement below: a side too narrow for it overflows,
            // so the pane drops under the appointment rather than being squeezed in beside it.
            minWidth: '440px',
            positionStrategy: buildAnchoredRuntimePositionStrategy({
              placement: 'right-start',
              fallbackPlacements: ['left-start', 'bottom', 'top', 'right', 'left'],
              offset: 10,
              arrowPadding: 16,
              shift: true,
              autoResize: true,
            }),
          }),
        },
      ];
    },
    panelClass: 'et-scheduler-edit-surface-panel',
  });

export const defineSchedulerAddOverlay = <TComponent extends object>(component: Type<TComponent>) =>
  defineOverlay<TComponent, SchedulerEditSurfaceResult>({
    component,
    strategies: () => {
      const fullscreenDialogStrategy = injectFullscreenDialogStrategy();
      const dialogStrategy = injectDialogStrategy();

      return [
        { strategy: fullscreenDialogStrategy.build() },
        { breakpoint: 'md', strategy: dialogStrategy.build({ maxWidth: '520px' }) },
      ];
    },
    panelClass: 'et-scheduler-edit-surface-panel',
  });
