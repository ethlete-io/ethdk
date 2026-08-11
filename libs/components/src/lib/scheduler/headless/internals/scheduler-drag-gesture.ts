import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AngularRenderer, DragGestureEvent, dragGestureFrom } from '@ethlete/core';
import { finalize, tap, timer } from 'rxjs';

/**
 * How long a finger has to stay still before it drags instead of scrolls. Long enough that the
 * browser has not started panning yet, short enough not to feel stuck.
 */
const TOUCH_ARM_DELAY = 400;

export type SchedulerDragGestureOptions = {
  event: PointerEvent;
  /** The surface being dragged on - the gesture's pointer capture and touch guard both hang off it. */
  element: HTMLElement;
  renderer: AngularRenderer;
  destroyRef: DestroyRef;
  /** The pointer is at this position - draw to it, or drag whatever was grabbed to it. */
  track: (clientX: number, clientY: number) => void;
  /** The pointer was released - keep the result. */
  settle: () => void;
  /** The gesture was taken away - drop the result. */
  cancel: () => void;
};

/**
 * One drag on a scheduler view, for both pointer kinds - drawing a new range across empty grid, or
 * moving and resizing an appointment already on it.
 *
 * A mouse drags as soon as it passes the gesture's commit threshold, so a click stays a click. A
 * finger cannot: the views scroll vertically, so the browser claims the pan and cancels the gesture.
 * It therefore arms on a long press held still - early enough that panning has not begun - after
 * which `touchmove` is prevented so it never does. That listener has to stay non-passive, which is
 * why this listens through the renderer rather than an event binding.
 */
export const startSchedulerDragGesture = (options: SchedulerDragGestureOptions) => {
  const { event, element, renderer, destroyRef, track, settle, cancel } = options;

  const touch = event.pointerType === 'touch';
  let armed = !touch;

  const stopBlockingScroll = touch
    ? renderer.listen(element, 'touchmove', (touchEvent: Event) => {
        if (armed && touchEvent.cancelable) touchEvent.preventDefault();
      })
    : () => undefined;

  const arm = () => {
    armed = true;
    track(event.clientX, event.clientY);
  };

  const arming = touch ? timer(TOUCH_ARM_DELAY).pipe(tap(arm), takeUntilDestroyed(destroyRef)).subscribe() : null;

  const apply = (gesture: DragGestureEvent) => {
    switch (gesture.type) {
      case 'start':
        return armed ? track(gesture.data.clientX, gesture.data.clientY) : undefined;
      case 'move':
        // a finger that moves before the press arms is scrolling the view, not dragging on it
        if (!armed) return arming?.unsubscribe();

        return track(gesture.data.clientX, gesture.data.clientY);
      // a long press released without moving still tracked once, so it settles like a drag
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
