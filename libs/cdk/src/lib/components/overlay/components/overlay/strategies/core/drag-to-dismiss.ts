import { elementCanScroll } from '@ethlete/core';
import { Subject, fromEvent, merge, takeUntil, tap } from 'rxjs';
import { SwipeEndEvent, SwipeTracker, SwipeUpdateEvent, createSwipeTracker } from '../../../../../../utils';
import { OverlayRef } from '../../overlay-ref';
import { OverlayDragToDismissConfig } from './types';

const isTouchEvent = (event: Event): event is TouchEvent => {
  return event.type[0] === 't';
};

export type DragToDismissContext<T, R> = {
  element: HTMLElement;
  overlayRef: OverlayRef<T, R>;
  config: OverlayDragToDismissConfig;
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
  cleanUp?: { delay: number; fn: (el: HTMLElement) => void };
} | null => {
  const { direction, minDistanceToDismiss = 150, minVelocityToDismiss = 150 } = config;
  const { movementX, movementY, pixelPerSecondX, pixelPerSecondY } = event;

  const cleanUp = {
    delay: 100,
    fn: (el: HTMLElement) => el.style.removeProperty('transition'),
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

  if (!el.parentElement || el.tagName.toLowerCase() === 'et-overlay-container') return null;

  return recursiveFindScrollableParent(el.parentElement, direction);
};

const shouldCancelDragForScrollableElement = (
  scrollableElement: HTMLElement,
  direction: OverlayDragToDismissConfig['direction'],
): boolean => {
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
export const enableDragToDismiss = <T, R>(context: DragToDismissContext<T, R>): DragToDismissRef => {
  const { element: el, overlayRef, config } = context;
  const stop$ = new Subject<void>();

  let tracker: SwipeTracker | null = null;
  let isSelectionActive = false;
  let savedUserSelect: string | null = null;

  const unlockSelection = () => {
    if (savedUserSelect === null) return;
    document.body.style.userSelect = savedUserSelect;
    savedUserSelect = null;
  };

  const lockSelection = () => {
    if (savedUserSelect !== null) return;
    savedUserSelect = document.body.style.userSelect ?? '';
    document.body.style.userSelect = 'none';
  };

  const cancelDrag = () => {
    unlockSelection();
    el.style.setProperty('transition', 'transform 100ms var(--ease-out-1)');
    el.style.transform =
      config.direction === 'to-bottom' || config.direction === 'to-top' ? 'translateY(0)' : 'translateX(0)';
    tracker = null;

    setTimeout(() => {
      el.style.removeProperty('transition');
      el.style.removeProperty('transform');
    }, 100);
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
    .pipe(takeUntil(stop$), takeUntil(overlayRef.afterClosed()))
    .subscribe(() => {
      const selection = document.getSelection();

      if (!selection || !selection.toString().length) {
        isSelectionActive = false;
        return;
      }

      isSelectionActive = true;
      cancelDrag();
    });

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

        Object.entries(css).forEach(([key, value]) => {
          el.style.setProperty(key, value);
        });
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
          overlayRef._closeOverlayVia('touch');
          return;
        }

        Object.entries(css).forEach(([key, value]) => {
          if (key === 'cleanUp') {
            if (typeof value === 'string' || !value) return;

            setTimeout(() => {
              value.fn(el);
            }, value.delay);

            return;
          }

          el.style.setProperty(key, value as string);
        });
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
