import { AngularRenderer, matchesReducedMotion, randomId } from '@ethlete/core';
import { interval, Subscription, tap } from 'rxjs';
import { observeKeyboardInset } from '../../internals/keyboard-inset';
import { DragDismissMomentum, DragToDismissRef, enableDragToDismiss } from './overlay-drag-to-dismiss';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';
import { SHEET_LEAVE_SPRING, springEasing } from './spring-easing';

const MAX_LEAVE_DURATION_MS = 450;

/** Below this release speed the swipe carries no momentum worth handing off. */
const MIN_LEAVE_SPEED = 50;

const RELEASE_FRAME_MS = 16;

/** Progress at which the leave ends. The rest of the spring would run with the sheet already off screen. */
const LEAVE_EPSILON = 0.002;

/** How often a sheet lifted above the soft keyboard re-checks the keyboard, to recover a missed viewport event. */
const KEYBOARD_POLL_MS = 500;

/**
 * Runs every close on a spring. A dismissing swipe hands the spring its release speed, so the exit
 * continues the swipe. Position is already continuous, because the drag's inline transform is what
 * the leave transition starts from.
 */
const applyLeaveSpring = (
  {
    el,
    backdropEl,
    momentum,
  }: { el: HTMLElement; backdropEl: HTMLElement | null; momentum: DragDismissMomentum | null },
  renderer: AngularRenderer,
) => {
  if (matchesReducedMotion(el)) return;

  const carriesMomentum = !!momentum && momentum.speed >= MIN_LEAVE_SPEED && momentum.remainingDistance > 0;
  const { durationMs, easing } = springEasing({
    ...SHEET_LEAVE_SPRING,
    initialVelocity: carriesMomentum ? momentum.speed / momentum.remainingDistance : 0,
    epsilon: LEAVE_EPSILON,
    stopAtTarget: true,
    maxDurationMs: MAX_LEAVE_DURATION_MS,
  });

  renderer.setStyle(el, {
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: easing,
    // A transition renders its start value on its first frame, which would hold the sheet still for
    // a frame after the release. Starting a frame in keeps it moving.
    transitionDelay: carriesMomentum ? `-${RELEASE_FRAME_MS}ms` : null,
  });

  if (backdropEl) renderer.setStyle(backdropEl, { transition: `opacity ${durationMs}ms ${easing}`, opacity: null });
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
      backdrop: () => context.backdropEl,
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
      // A close interrupted by a re-open must not inherit the previous swipe's timing or position.
      renderer.setStyle(context.containerEl, {
        transitionDuration: null,
        transitionTimingFunction: null,
        transitionDelay: null,
        transform: null,
      });

      if (context.backdropEl) renderer.setStyle(context.backdropEl, { transition: null, opacity: null });

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

      const momentum = dismissMomentum;
      dismissMomentum = null;

      applyLeaveSpring({ el: context.containerEl, backdropEl: context.backdropEl, momentum }, renderer);

      context.lifecycle.leave();

      // Only after leave() has added the leave-active transition, or the sheet jumps to the exit. Setting
      // it here starts the exit this frame instead of a frame later with the leave-to class.
      if (momentum) renderer.setStyle(context.containerEl, { transform: momentum.exitTransform });
    },
    onAfterLeave: stopKeyboardLift,
  };
};
