import {
  AngularRenderer,
  SwipeTracker,
  createSwipeTracker,
  elementCanScroll,
  matchesReducedMotion,
} from '@ethlete/core';
import { Subject, Subscription, filter, fromEvent, take, takeUntil, tap, timer } from 'rxjs';
import { claimsPointerAxis, isInteractivePointerTarget } from '../../internals/pointer-gesture-target';
import { OverlayRef } from '../overlay-ref';
import { getOverlayRefInternals } from '../overlay-ref-internal';
import {
  OverlayDragToDismissConfig,
  OverlayDragToDismissDirection,
  OverlayDragToDismissPhysicalDirection,
} from './overlay-strategy.types';
import { SHEET_SETTLE_SPRING, springEasing } from './spring-easing';

/** The momentum a dismissing gesture had when the pointer let go, so the exit can carry it. */
export type DragDismissMomentum = {
  /** Release speed along the dismiss axis in px/s. Always positive. */
  speed: number;

  /** How far the overlay still has to travel to clear its docked edge, in px. */
  remainingDistance: number;

  /** The CSS transform that places the overlay fully past its docked edge. */
  exitTransform: string;
};

export type DragToDismissContext = {
  element: HTMLElement;
  overlayRef: Pick<OverlayRef, 'beforeClosed' | 'afterClosed' | 'close'>;
  config: OverlayDragToDismissConfig;
  renderer: AngularRenderer;

  /**
   * Called immediately before the gesture closes the overlay, with the momentum of the release. The
   * sheet strategy uses it to give the leave transition the speed of the swipe instead of a fixed
   * duration - see `createSheetStrategy`.
   */
  onDismiss?: (momentum: DragDismissMomentum) => void;

  /** Called when a close guard vetoes the close a dismissing gesture requested. The overlay settles back. */
  onDismissVetoed?: () => void;

  /** The backdrop to fade with the drag offset. */
  backdrop?: () => HTMLElement | null;
};

export type DragToDismissRef = {
  unsubscribe: () => void;
};

/** The config with its direction resolved to a physical one, so the gesture math stays direction-agnostic. */
type ResolvedDragToDismissConfig = Omit<OverlayDragToDismissConfig, 'direction'> & {
  direction: OverlayDragToDismissPhysicalDirection;
};

/** Distance the pointer must travel along the dismiss axis before the overlay starts following it. */
const COMMIT_THRESHOLD_PX = 8;

const REDUCED_MOTION_SETTLE_MS = 100;
const MAX_SETTLE_DURATION_MS = 800;

/** The furthest a drag against the docked edge can stretch the overlay. Stays below the 50px overshoot fill. */
const RUBBER_BAND_LIMIT_PX = 48;
const RUBBER_BAND_COEFFICIENT = 0.55;

const rubberBand = (overshoot: number) =>
  RUBBER_BAND_LIMIT_PX * (1 - 1 / ((overshoot * RUBBER_BAND_COEFFICIENT) / RUBBER_BAND_LIMIT_PX + 1));

/**
 * Maps a logical direction onto the physical axis it points at for the element's writing direction.
 * Physical directions are returned as-is - they mean what they say in every writing direction.
 */
const resolvePhysicalDirection = (
  direction: OverlayDragToDismissDirection,
  el: HTMLElement,
): OverlayDragToDismissPhysicalDirection => {
  if (direction !== 'to-inline-start' && direction !== 'to-inline-end') {
    return direction;
  }

  const isRtl = getComputedStyle(el).direction === 'rtl';
  const pointsToStart = direction === 'to-inline-start';

  return pointsToStart === isRtl ? 'to-right' : 'to-left';
};

const isVerticalDismiss = (direction: OverlayDragToDismissPhysicalDirection) =>
  direction === 'to-bottom' || direction === 'to-top';

/** The dismiss axis as a set of conversions, so the gesture math never re-tests the direction. */
type DismissAxis = {
  /** Projects a vector (movement, velocity, …) onto the axis, positive toward dismissal. */
  project: (x: number, y: number) => number;

  /** Turns an offset (`0` = docked, positive = toward dismissal) into a CSS transform. */
  transform: (offset: number) => string;

  /** The overlay's own size along the axis - the distance a full dismissal covers. */
  extentOf: (el: HTMLElement) => number;
};

const createDismissAxis = (direction: OverlayDragToDismissPhysicalDirection): DismissAxis => {
  const isVertical = isVerticalDismiss(direction);
  const sign = direction === 'to-bottom' || direction === 'to-right' ? 1 : -1;

  return {
    project: (x, y) => (isVertical ? y : x) * sign,
    transform: (offset) => (isVertical ? `translateY(${offset * sign}px)` : `translateX(${offset * sign}px)`),
    extentOf: (el) => (isVertical ? el.offsetHeight : el.offsetWidth),
  };
};

/** Where the overlay goes once the pointer lifts. */
type SwipeEndResolution =
  | { readonly kind: 'settle'; readonly offset: number }
  | { readonly kind: 'dismiss'; readonly speed: number; readonly remainingDistance: number };

/**
 * Resting offsets along the dismiss axis, docked first. `snapPoints` are fractions of the axis, and
 * the docked position is always one of them whether or not the consumer listed it.
 */
const resolveSnapOffsets = (snapPoints: number[], axisExtent: number) =>
  [...new Set([0, ...snapPoints])]
    .filter((point) => point >= 0 && point < 1)
    .sort((a, b) => a - b)
    .map((point) => point * axisExtent);

type SwipeEndInput = {
  /** Where the overlay sits when the pointer lifts, in px along the dismiss axis. */
  currentOffset: number;

  /** Release velocity projected onto the dismiss axis. Positive points toward dismissal. */
  velocity: number;

  config: ResolvedDragToDismissConfig;

  axisExtent: number;
};

/**
 * Picks the target for a release against a set of snap offsets: a flick advances one offset in its
 * own direction, a slow release settles at the nearest one. Running out of offsets in the dismiss
 * direction means the overlay leaves.
 */
const resolveSnapEnd = (input: SwipeEndInput & { offsets: number[] }): SwipeEndResolution => {
  const { currentOffset, velocity, offsets, axisExtent } = input;
  const { minVelocityToDismiss = 150 } = input.config;
  const speed = Math.abs(velocity);
  const dismiss = { kind: 'dismiss', speed, remainingDistance: axisExtent - currentOffset } as const;

  if (speed >= minVelocityToDismiss) {
    const isFlickingAway = velocity > 0;
    // The 1px slack keeps a flick started exactly at a snap point from picking that same point.
    const next = isFlickingAway
      ? offsets.find((offset) => offset > currentOffset + 1)
      : [...offsets].reverse().find((offset) => offset < currentOffset - 1);

    if (next === undefined) {
      // Nothing left to advance to: away means out, back means the overlay is already docked.
      return isFlickingAway ? dismiss : { kind: 'settle', offset: 0 };
    }

    return { kind: 'settle', offset: next };
  }

  // A slow release settles wherever it is closest to - including the fully-dismissed position, which
  // is what makes an overlay dragged most of the way out finish the job instead of springing back.
  const nearest = [...offsets, axisExtent].reduce((best, offset) =>
    Math.abs(offset - currentOffset) < Math.abs(best - currentOffset) ? offset : best,
  );

  return nearest === axisExtent ? dismiss : { kind: 'settle', offset: nearest };
};

const resolveSwipeEnd = (input: SwipeEndInput): SwipeEndResolution => {
  const { currentOffset, velocity, axisExtent } = input;
  const { minDistanceToDismiss = 150, minVelocityToDismiss = 150, snapPoints } = input.config;

  if (snapPoints?.length) {
    return resolveSnapEnd({ ...input, offsets: resolveSnapOffsets(snapPoints, axisExtent) });
  }

  if (currentOffset >= minDistanceToDismiss || velocity >= minVelocityToDismiss) {
    return { kind: 'dismiss', speed: Math.abs(velocity), remainingDistance: axisExtent - currentOffset };
  }

  return { kind: 'settle', offset: 0 };
};

const recursiveFindScrollableParent = (
  el: HTMLElement,
  direction: OverlayDragToDismissPhysicalDirection,
): HTMLElement | null => {
  if (!el) return null;

  if (isVerticalDismiss(direction)) {
    if (elementCanScroll(el, 'y')) {
      return el;
    }
  } else {
    if (elementCanScroll(el, 'x')) {
      return el;
    }
  }

  if (!el.parentElement || el.classList.contains('et-overlay')) return null;

  return recursiveFindScrollableParent(el.parentElement, direction);
};

const shouldCancelDragForScrollableElement = (
  scrollableElement: HTMLElement,
  direction: OverlayDragToDismissPhysicalDirection,
) => {
  if (direction === 'to-bottom') {
    return scrollableElement.scrollTop !== 0;
  } else if (direction === 'to-top') {
    return Math.round(scrollableElement.scrollTop) !== scrollableElement.scrollHeight - scrollableElement.clientHeight;
  } else if (direction === 'to-right') {
    return scrollableElement.scrollLeft !== 0;
  } else {
    return Math.round(scrollableElement.scrollLeft) !== scrollableElement.scrollWidth - scrollableElement.clientWidth;
  }
};

/**
 * Enables drag-to-dismiss functionality on an overlay element.
 * Returns a cleanup function to disable the feature.
 */
export const enableDragToDismiss = (context: DragToDismissContext): DragToDismissRef => {
  const { element: el, overlayRef, renderer, onDismiss, onDismissVetoed, backdrop } = context;
  const config: ResolvedDragToDismissConfig = {
    ...context.config,
    direction: resolvePhysicalDirection(context.config.direction, el),
  };
  const axis = createDismissAxis(config.direction);
  const dismissAxisName = isVerticalDismiss(config.direction) ? 'y' : 'x';
  const document = el.ownerDocument;
  const stop$ = new Subject<void>();

  let tracker: SwipeTracker | null = null;
  let activePointerId: number | null = null;
  let isCommitted = false;
  let axisExtent = 0;

  /** Where the overlay sits right now, in px along the dismiss axis. Non-zero while at a snap point. */
  let currentOffset = 0;
  /** Where it sat when the current gesture began, so a drag composes with the offset it started from. */
  let gestureStartOffset = 0;
  /** The in-flight settle transition, if any. */
  let settleSub: Subscription | null = null;
  /** Where a settle that a pointerdown caught was headed, so a tap that never drags lets it finish. */
  let interruptedTarget: number | null = null;

  let isSelectionActive = false;
  let savedUserSelect: string | null = null;

  const unlockSelection = () => {
    if (savedUserSelect === null) return;
    renderer.setStyle(document.body, { userSelect: savedUserSelect || null });
    savedUserSelect = null;
  };

  const lockSelection = () => {
    if (savedUserSelect !== null) return;
    savedUserSelect = document.body.style.userSelect ?? '';
    renderer.setStyle(document.body, { userSelect: 'none' });
  };

  const backdropOpacityAt = (offset: number) => (axisExtent ? Math.min(1, Math.max(0, 1 - offset / axisExtent)) : 1);

  const styleBackdrop = (style: { transition: string | null; opacity: string | null }) => {
    const backdropEl = backdrop?.();

    if (backdropEl) renderer.setStyle(backdropEl, style);
  };

  const readRenderedOffset = () => {
    const { transform } = getComputedStyle(el);

    if (!transform || transform === 'none' || typeof DOMMatrixReadOnly === 'undefined') return currentOffset;

    const matrix = new DOMMatrixReadOnly(transform);

    return axis.project(matrix.m41, matrix.m42);
  };

  /**
   * Drops the inline transition, which lands the overlay on its settle target instantly. Only the
   * docked position may drop the inline transform too - a snap point has to keep holding the overlay
   * in place once the transition is gone.
   */
  const finishSettle = () => {
    settleSub?.unsubscribe();
    settleSub = null;
    renderer.setStyle(el, currentOffset ? { transition: null } : { transition: null, transform: null });
    styleBackdrop(
      currentOffset > 0
        ? { transition: null, opacity: `${backdropOpacityAt(currentOffset)}` }
        : { transition: null, opacity: null },
    );
  };

  /** Freezes a running settle where it is on screen, so the pointer takes over from there. */
  const interruptSettle = () => {
    if (!settleSub) return;

    const target = currentOffset;

    settleSub.unsubscribe();
    settleSub = null;
    currentOffset = readRenderedOffset();
    interruptedTarget = target;

    const backdropEl = backdrop?.();
    const opacity = backdropEl ? getComputedStyle(backdropEl).opacity : null;

    renderer.setStyle(el, { transition: null, transform: axis.transform(currentOffset) });
    styleBackdrop({ transition: 'none', opacity });
  };

  const settleAt = (offset: number, velocity: number) => {
    const distance = offset - currentOffset;

    currentOffset = offset;
    settleSub?.unsubscribe();
    settleSub = null;

    if (Math.abs(distance) < 0.5) {
      finishSettle();

      return;
    }

    const { durationMs, easing } = matchesReducedMotion(el)
      ? { durationMs: REDUCED_MOTION_SETTLE_MS, easing: 'var(--ease-out-3)' }
      : springEasing({
          ...SHEET_SETTLE_SPRING,
          initialVelocity: velocity / distance,
          epsilon: Math.max(0.001, 0.5 / Math.abs(distance)),
          maxDurationMs: MAX_SETTLE_DURATION_MS,
        });

    renderer.setStyle(el, {
      transition: `transform ${durationMs}ms ${easing}`,
      transform: axis.transform(offset),
    });
    styleBackdrop({ transition: `opacity ${durationMs}ms ${easing}`, opacity: `${backdropOpacityAt(offset)}` });

    settleSub = timer(durationMs).pipe(takeUntil(stop$), tap(finishSettle)).subscribe();
  };

  /** Drops the gesture state. A settle the pointerdown caught finishes, unless the gesture took over. */
  const forgetGesture = () => {
    const target = isCommitted ? null : interruptedTarget;

    interruptedTarget = null;

    if (target !== null) settleAt(target, 0);

    tracker = null;
    activePointerId = null;
    isCommitted = false;
  };

  const cancelDrag = () => {
    unlockSelection();
    settleAt(gestureStartOffset, 0);
    forgetGesture();
  };

  const endGesture = () => {
    const wasCommitted = isCommitted;
    const activeTracker = tracker;

    unlockSelection();
    forgetGesture();

    if (!wasCommitted || !activeTracker || isSelectionActive) return;

    const { pixelPerSecondX, pixelPerSecondY } = activeTracker.end();
    const velocity = axis.project(pixelPerSecondX, pixelPerSecondY);
    const resolution = resolveSwipeEnd({ currentOffset, velocity, config, axisExtent });

    if (resolution.kind === 'dismiss') {
      styleBackdrop({ transition: null, opacity: null });
      onDismiss?.({
        speed: resolution.speed,
        remainingDistance: resolution.remainingDistance,
        exitTransform: axis.transform(axisExtent),
      });

      let isLeaving = false;
      const leaveSub = overlayRef
        .beforeClosed()
        .pipe(
          take(1),
          tap(() => (isLeaving = true)),
        )
        .subscribe();

      const internals = getOverlayRefInternals(overlayRef as OverlayRef);

      if (internals) {
        internals.closeVia('drag');
      } else {
        overlayRef.close();
      }
      leaveSub.unsubscribe();

      if (isLeaving) return;

      onDismissVetoed?.();
      settleAt(gestureStartOffset, 0);

      return;
    }

    settleAt(resolution.offset, velocity);
  };

  fromEvent<PointerEvent>(el, 'pointerdown')
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap((event) => {
        if (isSelectionActive || activePointerId !== null) return;
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (isInteractivePointerTarget(event.target as HTMLElement)) return;
        if (claimsPointerAxis(event.target as HTMLElement, { boundary: el, axis: dismissAxisName })) return;

        // A settle still animating would otherwise smooth the drag and leave the overlay's real
        // position behind its tracked one.
        interruptSettle();

        tracker = createSwipeTracker(event);
        activePointerId = event.pointerId;
        isCommitted = false;
        gestureStartOffset = currentOffset;
        axisExtent = axis.extentOf(el);
      }),
    )
    .subscribe();

  fromEvent<Event>(document, 'selectionchange')
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap(() => {
        const selection = document.getSelection();

        if (!selection || !selection.toString().length) {
          isSelectionActive = false;

          return;
        }

        isSelectionActive = true;

        if (isCommitted) {
          cancelDrag();
        } else {
          forgetGesture();
        }
      }),
    )
    .subscribe();

  // Pointer events cannot suppress native scrolling - `preventDefault` on `pointermove` is ignored,
  // and `touch-action` is no help here because it would also disable scrolling inside the overlay
  // body, which pans on the very axis the gesture uses. So the gesture itself runs on pointer events
  // while this one non-passive listener does nothing but keep the page still once it has committed.
  fromEvent<TouchEvent>(el, 'touchmove', { passive: false })
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap((event) => {
        if (isCommitted && event.cancelable) event.preventDefault();
      }),
    )
    .subscribe();

  // Listening on the document rather than the element covers the pre-commit moves, which happen
  // before `setPointerCapture` retargets anything to the overlay.
  fromEvent<PointerEvent>(document, 'pointermove')
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      filter((event) => event.pointerId === activePointerId),
      tap((event) => {
        if (tracker === null || isSelectionActive) return;

        const { movementX, movementY } = tracker.update(event);
        const travelled = axis.project(movementX, movementY);

        if (!isCommitted) {
          // Travel back toward the docked edge only counts when there is somewhere to go back to:
          // sitting at a snap point it drags the overlay in, but fully docked it is not this
          // gesture's business and must stay available to whatever else wants the pointer.
          const committedDistance = gestureStartOffset > 0 ? Math.abs(travelled) : travelled;

          if (committedDistance < COMMIT_THRESHOLD_PX) return;

          // The threshold doubles as the window in which the browser may claim the gesture for a
          // scroll: touch input starting on already-scrolled content is a scroll, not a drag.
          if (event.pointerType !== 'mouse') {
            const scrollable = recursiveFindScrollableParent(event.target as HTMLElement, config.direction);

            if (scrollable && shouldCancelDragForScrollableElement(scrollable, config.direction)) {
              forgetGesture();

              return;
            }
          }

          isCommitted = true;
          interruptedTarget = null;
          el.setPointerCapture(event.pointerId);
          lockSelection();
        }

        const offset = gestureStartOffset + travelled;

        currentOffset = offset < 0 ? -rubberBand(-offset) : Math.min(offset, axisExtent);
        renderer.setStyle(el, { transform: axis.transform(currentOffset) });
        styleBackdrop({ transition: 'none', opacity: `${backdropOpacityAt(currentOffset)}` });
      }),
    )
    .subscribe();

  fromEvent<PointerEvent>(document, 'pointerup')
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      filter((event) => event.pointerId === activePointerId),
      tap(endGesture),
    )
    .subscribe();

  // The browser took the gesture over (a native scroll won the disambiguation, the pointer left the
  // window). Put the overlay back where the gesture started rather than acting on an input the user
  // never completed.
  fromEvent<PointerEvent>(document, 'pointercancel')
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      filter((event) => event.pointerId === activePointerId),
      tap(() => {
        if (isCommitted) {
          cancelDrag();
        } else {
          forgetGesture();
        }
      }),
    )
    .subscribe();

  return {
    unsubscribe: () => {
      unlockSelection();
      stop$.next();
      stop$.complete();
    },
  };
};
