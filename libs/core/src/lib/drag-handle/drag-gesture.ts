import {
  EMPTY,
  Observable,
  concat,
  concatMap,
  defer,
  filter,
  finalize,
  fromEvent,
  merge,
  of,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { suppressTextSelection } from '../utils/text-selection';

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

export type DragEndEvent = {
  /** Pointer position at release - the last move can lag it by a frame of movement. */
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
  | { readonly type: 'end'; readonly data: DragEndEvent }
  | { readonly type: 'cancelled' };

// jsdom and other non-browser DOMs ship no pointer capture; the document listeners track the
// gesture either way, so a failure here only costs events over a cross-origin frame.
const capturePointer = (el: HTMLElement, pointerId: number) => {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    return;
  }
};

const setupDragObservable = (
  startEvent: PointerEvent,
  el: HTMLElement,
  commitThreshold: number,
): Observable<DragGestureEvent> => {
  const { pointerId, clientX: startX, clientY: startY } = startEvent;

  let cancelled = false;
  let endX = startX;
  let endY = startY;

  const end$ = merge(
    fromEvent<PointerEvent>(document, 'pointerup'),
    fromEvent<PointerEvent>(document, 'pointercancel'),
  ).pipe(
    filter((e) => e.pointerId === pointerId),
    take(1),
    // Read below by the terminating `defer`, which only runs once this has completed the moves.
    tap((e) => {
      cancelled = e.type === 'pointercancel';
      endX = e.clientX;
      endY = e.clientY;
    }),
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
        capturePointer(el, pointerId);
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

  return defer(() => {
    const releaseSelection = suppressTextSelection(el.ownerDocument);

    return concat(
      moves$,
      defer((): Observable<DragGestureEvent> => {
        if (cancelled) return of({ type: 'cancelled' as const });
        if (!committed) return of({ type: 'tapped' as const });

        return of({
          type: 'end' as const,
          data: { clientX: endX, clientY: endY, totalDx: endX - startX, totalDy: endY - startY },
        });
      }),
    ).pipe(finalize(releaseSelection));
  });
};

/**
 * Observe one drag gesture, starting from a `pointerdown` on `element`.
 *
 * Emits `start` once the pointer has travelled `commitThreshold` px (so a click is not a drag),
 * immediately followed by a catch-up `move`, then a `move` per pointer move, and finally `end`
 * carrying the release position. A pointer released before crossing the threshold emits a single
 * `tapped` instead - its position is the `pointerdown` the caller already holds. The stream
 * completes with the gesture, so there is nothing to unsubscribe on the happy path.
 *
 * Text selection is suppressed on the element's document for as long as the gesture runs, so a drag
 * does not sweep a selection across the page.
 *
 * A gesture the browser takes away - a `pointercancel` from a system gesture, an incoming call, the
 * tab going to the background - ends on `cancelled` rather than `end` or `tapped`. Treat it as
 * "revert", not "drop here": the user never let go, so there is no position they chose.
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
