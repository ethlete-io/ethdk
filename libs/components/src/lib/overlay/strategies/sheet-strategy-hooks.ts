import { AngularRenderer, randomId } from '@ethlete/core';
import { DragToDismissRef, enableDragToDismiss } from './overlay-drag-to-dismiss';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';

/** Shared strategy shape for all sheet variants: default enter/leave animations plus drag-to-dismiss. */
export const createSheetStrategy = (config: OverlayBreakpointConfig, renderer: AngularRenderer): OverlayStrategy => {
  let dragToDismissRef: DragToDismissRef | undefined;

  const attachDragToDismiss = (context: OverlayStrategyContext) => {
    if (!config.dragToDismiss) return;

    dragToDismissRef = enableDragToDismiss({
      config: config.dragToDismiss,
      element: context.containerEl,
      overlayRef: context.overlayRef,
      renderer,
    });
  };

  const detachDragToDismiss = () => {
    dragToDismissRef?.unsubscribe();
    dragToDismissRef = undefined;
  };

  return {
    id: randomId(),
    config,
    onBeforeEnter: (context) => context.lifecycle.enter(),
    onAfterEnter: (context) => attachDragToDismiss(context),
    onSwitchedTo: attachDragToDismiss,
    onSwitchedAwayFrom: detachDragToDismiss,
    onBeforeLeave: (context) => {
      detachDragToDismiss();
      context.lifecycle.leave();
    },
  };
};
