import { AngularRenderer, matchesReducedMotion, randomId } from '@ethlete/core';
import { interval, Subscription, tap } from 'rxjs';
import { observeKeyboardInset } from '../../internals/keyboard-inset';
import { DragDismissMomentum, DragToDismissRef, enableDragToDismiss } from './overlay-drag-to-dismiss';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';

/** Bounds for the momentum-driven exit, matching the drag gesture's own settle animation. */
const MIN_LEAVE_DURATION_MS = 100;
const MAX_LEAVE_DURATION_MS = 350;

/** Below this release speed the swipe carries no momentum worth handing off. */
const MIN_LEAVE_SPEED = 50;

/** How often a sheet lifted above the soft keyboard re-checks the keyboard, to recover a missed viewport event. */
const KEYBOARD_POLL_MS = 500;

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

export type SheetStrategyDeps = {
  renderer: AngularRenderer;

  /** Read on open: whether the sheet docks on the soft keyboard instead of staying behind it. */
  liftAboveKeyboard?: () => boolean;
};

/** Shared strategy shape for all sheet variants: default enter/leave animations plus drag-to-dismiss. */
export const createSheetStrategy = (
  config: OverlayBreakpointConfig,
  { renderer, liftAboveKeyboard }: SheetStrategyDeps,
): OverlayStrategy => {
  let dragToDismissRef: DragToDismissRef | undefined;
  let dismissMomentum: DragDismissMomentum | null = null;
  let keyboardLift: Subscription | undefined;

  const applyKeyboardLift = (pane: HTMLElement, inset: number) =>
    renderer.setCssProperties(pane, {
      'margin-block-end': inset ? `${inset}px` : null,
      '--et-overlay-max-height': inset ? `calc(100% - ${inset}px)` : null,
    });

  const stopKeyboardLift = (context: OverlayStrategyContext) => {
    if (!keyboardLift) return;

    keyboardLift.unsubscribe();
    keyboardLift = undefined;
    applyKeyboardLift(context.containerEl, 0);
  };

  const startKeyboardLift = (context: OverlayStrategyContext) => {
    stopKeyboardLift(context);

    const view = context.containerEl.ownerDocument.defaultView;

    if (!view || !liftAboveKeyboard?.()) return;

    let inset = 0;
    const lift = () => applyKeyboardLift(context.containerEl, inset);

    keyboardLift = observeKeyboardInset({
      view,
      renderer,
      onInset: (next) => {
        inset = next;
        lift();
      },
      // re-asserts the lift too: a strategy switch re-positions the pane after onSwitchedTo, which
      // clears `--et-overlay-max-height`
      poll$: interval(KEYBOARD_POLL_MS).pipe(tap(lift)),
    }).subscribe();
  };

  const attachDragToDismiss = (context: OverlayStrategyContext) => {
    if (!config.dragToDismiss) return;

    dragToDismissRef = enableDragToDismiss({
      config: config.dragToDismiss,
      element: context.containerEl,
      overlayRef: context.overlayRef,
      renderer,
      onDismiss: (momentum) => (dismissMomentum = momentum),
      onDismissVetoed: () => (dismissMomentum = null),
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
      startKeyboardLift(context);
      context.lifecycle.enter();
    },
    onAfterEnter: (context) => attachDragToDismiss(context),
    onSwitchedTo: (context) => {
      attachDragToDismiss(context);
      startKeyboardLift(context);
    },
    onSwitchedAwayFrom: (context) => {
      detachDragToDismiss();
      stopKeyboardLift(context);
    },
    onBeforeLeave: (context) => {
      detachDragToDismiss();

      if (dismissMomentum) {
        applyDismissMomentum({ el: context.containerEl, momentum: dismissMomentum }, renderer);
        dismissMomentum = null;
      }

      context.lifecycle.leave();
    },
    onAfterLeave: stopKeyboardLift,
  };
};
