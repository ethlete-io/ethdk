import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AngularRenderer, DragGestureEvent, dragGestureFrom } from '@ethlete/core';
import { finalize, tap, timer } from 'rxjs';

/**
 * How long a finger has to stay still before it draws instead of scrolls. Long enough that the
 * browser has not started panning yet, short enough not to feel stuck.
 */
const TOUCH_ARM_DELAY = 400;

export type SchedulerDraftGestureOptions = {
  event: PointerEvent;
  /** The surface being drawn on - the gesture's pointer capture and touch guard both hang off it. */
  element: HTMLElement;
  renderer: AngularRenderer;
  destroyRef: DestroyRef;
  /** Extends the range to a pointer position, starting it if there is nothing drawn yet. */
  draw: (clientX: number, clientY: number) => void;
  /** The pointer was released - keep whatever is drawn. */
  settle: () => void;
  /** The gesture was taken away - drop whatever is drawn. */
  cancel: () => void;
};

/**
 * Draws a range by dragging across a scheduler view, for both pointer kinds.
 *
 * A mouse draws as soon as the drag passes the gesture's commit threshold, so a click stays a
 * click. A finger cannot: the views scroll vertically, so the browser claims the pan and cancels
 * the gesture. It therefore arms on a long press held still - early enough that panning has not
 * begun - after which `touchmove` is prevented so it never does. That listener has to stay
 * non-passive, which is why this listens through the renderer rather than an event binding.
 */
export const startSchedulerDraftGesture = (options: SchedulerDraftGestureOptions) => {
  const { event, element, renderer, destroyRef, draw, settle, cancel } = options;

  const touch = event.pointerType === 'touch';
  let armed = !touch;

  const stopBlockingScroll = touch
    ? renderer.listen(element, 'touchmove', (touchEvent: Event) => {
        if (armed && touchEvent.cancelable) touchEvent.preventDefault();
      })
    : () => undefined;

  const arm = () => {
    armed = true;
    draw(event.clientX, event.clientY);
  };

  const arming = touch ? timer(TOUCH_ARM_DELAY).pipe(tap(arm), takeUntilDestroyed(destroyRef)).subscribe() : null;

  const apply = (gesture: DragGestureEvent) => {
    switch (gesture.type) {
      case 'start':
        return armed ? draw(gesture.data.clientX, gesture.data.clientY) : undefined;
      case 'move':
        // a finger that moves before the press arms is scrolling the view, not drawing on it
        if (!armed) return arming?.unsubscribe();

        return draw(gesture.data.clientX, gesture.data.clientY);
      // a long press released without moving still drew its first unit, so it settles like a drag
      case 'end':
      case 'tapped':
        return settle();
      case 'cancelled':
        return cancel();
    }
  };

  const dispose = () => {
    arming?.unsubscribe();
    stopBlockingScroll();
  };

  dragGestureFrom(event, element).pipe(tap(apply), finalize(dispose), takeUntilDestroyed(destroyRef)).subscribe();
};
