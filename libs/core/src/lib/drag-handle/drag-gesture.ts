import { EMPTY, Observable, concat, concatMap, defer, filter, fromEvent, merge, of, take, takeUntil } from 'rxjs';

export type DragStartEvent = {
  /** Pointer position at pointerdown - NOT at commit-threshold crossing. */
  readonly clientX: number;
  readonly clientY: number;
};

export type DragMoveEvent = {
  readonly stepX: number;
  readonly stepY: number;
  readonly clientX: number;
  readonly clientY: number;
  /** Cumulative delta from the pointerdown position. */
  readonly totalDx: number;
  readonly totalDy: number;
};

export type DragGestureEvent =
  | { readonly type: 'tapped' }
  | { readonly type: 'start'; readonly data: DragStartEvent }
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
        // Emit the catch-up move together with start so consumers snap to the pointer
        // at commit instead of trailing it by the threshold distance until the next move.
        const start: DragGestureEvent = { type: 'start', data: { clientX: startX, clientY: startY } };
        const catchUpMove: DragGestureEvent = {
          type: 'move',
          data: {
            stepX: e.clientX - startX,
            stepY: e.clientY - startY,
            clientX: e.clientX,
            clientY: e.clientY,
            totalDx: e.clientX - startX,
            totalDy: e.clientY - startY,
          },
        };

        return of(start, catchUpMove);
      }

      const stepX = e.clientX - lastX;
      const stepY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      return of({
        type: 'move' as const,
        data: {
          stepX,
          stepY,
          clientX: e.clientX,
          clientY: e.clientY,
          totalDx: e.clientX - startX,
          totalDy: e.clientY - startY,
        },
      });
    }),
    takeUntil(end$),
  );

  return concat(
    moves$,
    defer((): Observable<DragGestureEvent> => of(committed ? { type: 'end' } : { type: 'tapped' })),
  );
};

/**
 * Observe one drag gesture, starting from a `pointerdown` on `element`.
 *
 * Emits `start` once the pointer has travelled `commitThreshold` px (so a click is not a drag),
 * immediately followed by a catch-up `move`, then a `move` per pointer move, and finally `end`. A
 * pointer released before crossing the threshold emits a single `tapped` instead. The stream
 * completes with the gesture, so there is nothing to unsubscribe on the happy path.
 *
 * This is the primitive behind {@link DragHandleDirective}. Prefer the directive; reach for this when
 * the draggable element belongs to someone else's template (e.g. a table feature attaching a drag to
 * header cells the table itself renders) and you can only work from a delegated `pointerdown`.
 */
export const dragGestureFrom = (
  event: PointerEvent,
  element: HTMLElement,
  options?: { commitThreshold?: number },
): Observable<DragGestureEvent> => setupDragObservable(event, element, options?.commitThreshold ?? 8);
