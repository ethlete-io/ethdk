import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AngularRenderer, DragGestureEvent, dragGestureFrom } from '@ethlete/core';
import { finalize, tap, timer } from 'rxjs';

const TOUCH_ARM_DELAY = 400;

export type SchedulerDragGestureOptions = {
  event: PointerEvent;
  element: HTMLElement;
  renderer: AngularRenderer;
  destroyRef: DestroyRef;
  track: (clientX: number, clientY: number) => void;
  settle: () => void;
  cancel: () => void;
};

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
