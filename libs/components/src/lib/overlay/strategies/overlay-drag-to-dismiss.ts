import {
  AngularRenderer,
  SwipeEndEvent,
  SwipeTracker,
  SwipeUpdateEvent,
  createSwipeTracker,
  elementCanScroll,
} from '@ethlete/core';
import { Subject, fromEvent, merge, takeUntil, tap, timer } from 'rxjs';
import { OverlayRef } from '../overlay-ref';
import { isTouchEvent } from './overlay-origin';
import { OverlayDragToDismissConfig } from './overlay-strategy.types';

export type DragToDismissContext = {
  element: HTMLElement;
  overlayRef: OverlayRef<object, unknown>;
  config: OverlayDragToDismissConfig;
  renderer: AngularRenderer;
};

export type DragToDismissRef = {
  unsubscribe: () => void;
};

const defaultSwipeMoveStyleInterpolator = (
  event: SwipeUpdateEvent,
  config: OverlayDragToDismissConfig,
): Record<string, string> => {
  const { direction } = config;
  const { movementX, movementY } = event;

  if (direction === 'to-bottom') {
    return {
      transform: `translateY(${movementY < 0 ? 0 : movementY}px)`,
    };
  } else if (direction === 'to-top') {
    return {
      transform: `translateY(${movementY > 0 ? 0 : movementY}px)`,
    };
  } else if (direction === 'to-left') {
    return {
      transform: `translateX(${movementX > 0 ? 0 : movementX}px)`,
    };
  } else {
    return {
      transform: `translateX(${movementX < 0 ? 0 : movementX}px)`,
    };
  }
};

const defaultSwipeEndStyleInterpolator = (
  event: SwipeEndEvent,
  config: OverlayDragToDismissConfig,
): {
  transform: string;
  transition: string;
  cleanUp?: { delay: number };
} | null => {
  const { direction, minDistanceToDismiss = 150, minVelocityToDismiss = 150 } = config;
  const { movementX, movementY, pixelPerSecondX, pixelPerSecondY } = event;

  const cleanUp = {
    delay: 100,
  };

  if (direction === 'to-bottom') {
    if (movementY < minDistanceToDismiss && pixelPerSecondY < minVelocityToDismiss) {
      return {
        transform: `translateY(0)`,
        transition: 'transform 100ms var(--ease-out-1)',
        cleanUp: movementY ? cleanUp : undefined,
      };
    } else {
      return null;
    }
  }
  if (direction === 'to-top') {
    if (movementY > -minDistanceToDismiss && pixelPerSecondY > -minVelocityToDismiss) {
      return {
        transform: `translateY(0)`,
        transition: 'transform 100ms var(--ease-out-1)',
        cleanUp: movementY ? cleanUp : undefined,
      };
    } else {
      return null;
    }
  } else if (direction === 'to-left') {
    if (movementX > -minDistanceToDismiss && pixelPerSecondX > -minVelocityToDismiss) {
      return {
        transform: `translateX(0)`,
        transition: 'transform 100ms var(--ease-out-1)',
        cleanUp: movementX ? cleanUp : undefined,
      };
    } else {
      return null;
    }
  } else {
    if (movementX < minDistanceToDismiss && pixelPerSecondX < minVelocityToDismiss) {
      return {
        transform: `translateX(0)`,
        transition: 'transform 100ms var(--ease-out-1)',
        cleanUp: movementX ? cleanUp : undefined,
      };
    } else {
      return null;
    }
  }
};

const recursiveFindScrollableParent = (
  el: HTMLElement,
  direction: OverlayDragToDismissConfig['direction'],
): HTMLElement | null => {
  if (!el) return null;

  if (direction === 'to-bottom' || direction === 'to-top') {
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
  direction: OverlayDragToDismissConfig['direction'],
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
  const { element: el, overlayRef, config, renderer } = context;
  const document = el.ownerDocument;
  const stop$ = new Subject<void>();

  let tracker: SwipeTracker | null = null;
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

  const scheduleTransitionCleanup = (delay: number) => {
    timer(delay)
      .pipe(tap(() => renderer.setStyle(el, { transition: null })))
      .subscribe();
  };

  const cancelDrag = () => {
    unlockSelection();
    renderer.setStyle(el, {
      transition: 'transform 100ms var(--ease-out-1)',
      transform: config.direction === 'to-bottom' || config.direction === 'to-top' ? 'translateY(0)' : 'translateX(0)',
    });
    tracker = null;

    timer(100)
      .pipe(tap(() => renderer.setStyle(el, { transition: null, transform: null })))
      .subscribe();
  };

  merge(fromEvent<TouchEvent>(el, 'touchstart'), fromEvent<MouseEvent>(el, 'mousedown'))
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap((event) => {
        if (isSelectionActive) return;

        const target = event.target as HTMLElement;
        const tag = target.tagName.toLowerCase();

        if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') return;

        tracker = createSwipeTracker(event);
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
        cancelDrag();
      }),
    )
    .subscribe();

  merge(fromEvent<TouchEvent>(el, 'touchmove', { passive: false }), fromEvent<MouseEvent>(el, 'mousemove'))
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap((event) => {
        if (tracker === null || isSelectionActive) return;

        if (isTouchEvent(event)) {
          const target = event.target as HTMLElement;
          const scrollableElement = recursiveFindScrollableParent(target, config.direction);

          if (scrollableElement && shouldCancelDragForScrollableElement(scrollableElement, config.direction)) {
            cancelDrag();

            return;
          }

          event.preventDefault();
        }

        const swipeData = tracker.update(event);

        if (!isTouchEvent(event)) {
          if (savedUserSelect === null) {
            const { movementX, movementY } = swipeData;
            const committed =
              config.direction === 'to-bottom'
                ? movementY >= 8
                : config.direction === 'to-top'
                  ? movementY <= -8
                  : config.direction === 'to-left'
                    ? movementX <= -8
                    : movementX >= 8;
            if (!committed) return;
            lockSelection();
          }
        }

        const css = defaultSwipeMoveStyleInterpolator(swipeData, config);

        renderer.setStyle(el, css);
      }),
    )
    .subscribe();

  merge(fromEvent<TouchEvent>(el, 'touchend'), fromEvent<MouseEvent>(el, 'mouseup'))
    .pipe(
      takeUntil(stop$),
      takeUntil(overlayRef.afterClosed()),
      tap((event) => {
        const wasMouseDrag = !isTouchEvent(event) && savedUserSelect !== null;
        unlockSelection();

        if (tracker === null || isSelectionActive) return;

        if (!isTouchEvent(event) && !wasMouseDrag) {
          tracker = null;

          return;
        }

        const swipeData = tracker.end();
        tracker = null;
        const css = defaultSwipeEndStyleInterpolator(swipeData, config);

        if (!css) {
          overlayRef.closeVia('drag');

          return;
        }

        renderer.setStyle(el, { transform: css.transform, transition: css.transition });

        if (css.cleanUp) {
          scheduleTransitionCleanup(css.cleanUp.delay);
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
