import { AngularRenderer, matchesReducedMotion, randomId } from '@ethlete/core';
import { DragDismissMomentum, DragToDismissRef, enableDragToDismiss } from './overlay-drag-to-dismiss';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';

/** Bounds for the momentum-driven exit, matching the drag gesture's own settle animation. */
const MIN_LEAVE_DURATION_MS = 100;
const MAX_LEAVE_DURATION_MS = 350;

/** Below this release speed the swipe carries no momentum worth handing off. */
const MIN_LEAVE_SPEED = 50;

/**
 * Gives the leave transition the speed the swipe had when it let go, instead of the fixed duration
 * the stylesheet uses for every other close. Only the duration is overridden - position is already
 * continuous, because the drag's inline transform is what the leave transition starts from.
 */
const applyDismissMomentum = (
  { el, momentum }: { el: HTMLElement; momentum: DragDismissMomentum },
  renderer: AngularRenderer,
) => {
  if (momentum.speed < MIN_LEAVE_SPEED || matchesReducedMotion(el)) return;

  const ideal = (momentum.remainingDistance / momentum.speed) * 1000;
  const duration = Math.round(Math.min(MAX_LEAVE_DURATION_MS, Math.max(MIN_LEAVE_DURATION_MS, ideal)));

  renderer.setStyle(el, { transitionDuration: `${duration}ms` });
};

/** Shared strategy shape for all sheet variants: default enter/leave animations plus drag-to-dismiss. */
export const createSheetStrategy = (config: OverlayBreakpointConfig, renderer: AngularRenderer): OverlayStrategy => {
  let dragToDismissRef: DragToDismissRef | undefined;
  let dismissMomentum: DragDismissMomentum | null = null;

  const attachDragToDismiss = (context: OverlayStrategyContext) => {
    if (!config.dragToDismiss) return;

    dragToDismissRef = enableDragToDismiss({
      config: config.dragToDismiss,
      element: context.containerEl,
      overlayRef: context.overlayRef,
      renderer,
      onDismiss: (momentum) => (dismissMomentum = momentum),
    });
  };

  const detachDragToDismiss = () => {
    dragToDismissRef?.unsubscribe();
    dragToDismissRef = undefined;
  };

  return {
    id: randomId(),
    config,
    onBeforeEnter: (context) => {
      // A close interrupted by a re-open must not inherit the previous swipe's duration.
      renderer.setStyle(context.containerEl, { transitionDuration: null });
      dismissMomentum = null;
      context.lifecycle.enter();
    },
    onAfterEnter: (context) => attachDragToDismiss(context),
    onSwitchedTo: attachDragToDismiss,
    onSwitchedAwayFrom: detachDragToDismiss,
    onBeforeLeave: (context) => {
      detachDragToDismiss();

      if (dismissMomentum) {
        applyDismissMomentum({ el: context.containerEl, momentum: dismissMomentum }, renderer);
        dismissMomentum = null;
      }

      context.lifecycle.leave();
    },
  };
};
