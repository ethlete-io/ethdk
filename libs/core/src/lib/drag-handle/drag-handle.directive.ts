import { Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  fromEvent,
  map,
  merge,
  of,
  share,
  take,
  takeUntil,
} from 'rxjs';

import { applyHostListener } from '../utils/angular/host-listener';

export type DragMoveEvent = {
  readonly stepX: number;
  readonly stepY: number;
  readonly clientX: number;
  readonly clientY: number;
};

type DragGestureEvent =
  | { readonly type: 'tapped' }
  | { readonly type: 'start' }
  | { readonly type: 'move'; readonly data: DragMoveEvent }
  | { readonly type: 'end' };

const setupDragObservable = (
  startEvent: PointerEvent,
  el: HTMLElement,
  commitThreshold: number,
): Observable<DragGestureEvent> => {
  const { pointerId, clientX: startX, clientY: startY } = startEvent;

  const end$ = merge(
    fromEvent<PointerEvent>(document, 'pointerup'),
    fromEvent<PointerEvent>(document, 'pointercancel'),
  ).pipe(
    filter((e) => e.pointerId === pointerId),
    take(1),
  );

  let lastX = startX;
  let lastY = startY;
  let committed = false;

  const moves$ = fromEvent<PointerEvent>(document, 'pointermove').pipe(
    filter((e) => e.pointerId === pointerId),
    concatMap((e): Observable<DragGestureEvent> => {
      if (!committed) {
        if (Math.abs(e.clientX - startX) < commitThreshold && Math.abs(e.clientY - startY) < commitThreshold) {
          return EMPTY;
        }
        committed = true;
        el.setPointerCapture(pointerId);
        lastX = e.clientX;
        lastY = e.clientY;
        return of({ type: 'start' as const });
      }

      const stepX = e.clientX - lastX;
      const stepY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      return of({ type: 'move' as const, data: { stepX, stepY, clientX: e.clientX, clientY: e.clientY } });
    }),
    takeUntil(end$),
  );

  return concat(
    moves$,
    defer((): Observable<DragGestureEvent> => of(committed ? { type: 'end' } : { type: 'tapped' })),
  );
};

@Directive({
  selector: '[etDragHandle]',
})
export class DragHandleDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  commitThreshold = input(8);
  disabled = input(false, { transform: booleanAttribute });

  private gestureStart$ = new Subject<PointerEvent>();

  private gesture$ = this.gestureStart$.pipe(
    exhaustMap((event) => setupDragObservable(event, this.el.nativeElement, this.commitThreshold())),
    takeUntilDestroyed(),
    share(),
  );

  dragTapped = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'tapped'),
      map(() => undefined),
    ),
  );

  dragStarted = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'start'),
      map(() => undefined),
    ),
  );

  dragMoved = outputFromObservable<DragMoveEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<DragGestureEvent, { type: 'move' }> => e.type === 'move'),
      map((e) => e.data),
    ),
  );

  dragEnded = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'end'),
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

  startGesture(event: PointerEvent): void {
    if (event.button !== 0 || this.disabled()) return;
    event.stopPropagation();
    this.gestureStart$.next(event);
  }
}
