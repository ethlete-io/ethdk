import { Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject, distinctUntilChanged, exhaustMap, filter, map, share } from 'rxjs';
import { DragEndEvent, DragGestureEvent, DragMoveEvent, DragStartEvent, dragGestureFrom } from './drag-gesture';
import { applyHostListener } from '../utils/angular/host-listener';

@Directive({
  selector: '[etDragHandle]',
  host: {
    // Without this the browser claims touch pointermoves for scrolling and fires pointercancel,
    // so a touch drag never gets past the commit threshold. Scrolling stays available while the
    // handle is disabled.
    '[style.touch-action]': "disabled() ? null : 'none'",
  },
})
export class DragHandleDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  commitThreshold = input(8);
  disabled = input(false, { transform: booleanAttribute });

  private gestureStart$ = new Subject<PointerEvent>();

  private gesture$ = this.gestureStart$.pipe(
    exhaustMap((event) => dragGestureFrom(event, this.el.nativeElement, { commitThreshold: this.commitThreshold() })),
    takeUntilDestroyed(),
    share(),
  );

  dragTapped = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'tapped'),
      map(() => undefined),
    ),
  );

  dragStarted = outputFromObservable<DragStartEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<DragGestureEvent, { type: 'start' }> => e.type === 'start'),
      map((e) => e.data),
    ),
  );

  dragMoved = outputFromObservable<DragMoveEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<DragGestureEvent, { type: 'move' }> => e.type === 'move'),
      map((e) => e.data),
    ),
  );

  dragEnded = outputFromObservable<DragEndEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<DragGestureEvent, { type: 'end' }> => e.type === 'end'),
      map((e) => e.data),
    ),
  );

  /**
   * The browser took the gesture away mid-drag (a system gesture, an incoming call, the tab going to
   * the background). Revert to where the drag started - the user never chose a drop position. A
   * consumer that does not handle this leaves the item wherever the pointer happened to be.
   */
  dragCancelled = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'cancelled'),
      map(() => undefined),
    ),
  );

  isDragging = toSignal(
    this.gesture$.pipe(
      map((e) => e.type === 'start' || e.type === 'move'),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  constructor() {
    applyHostListener('pointerdown', (e) => this.startGesture(e));
  }

  startGesture(event: PointerEvent) {
    if (event.button !== 0 || this.disabled()) return;
    event.stopPropagation();
    this.gestureStart$.next(event);
  }
}
