import {
  EMPTY,
  Observable,
  concat,
  concatMap,
  defer,
  filter,
  finalize,
  fromEvent,
  ignoreElements,
  merge,
  of,
  share,
  Subject,
  take,
  takeUntil,
  tap,
  timer,
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

const HOLD_SLOP_PX = 8;

const setupDragObservable = (
  startEvent: PointerEvent,
  el: HTMLElement,
  commitThreshold: number,
  touchHoldDelay: number,
): Observable<DragGestureEvent> => {
  const { pointerId, clientX: startX, clientY: startY } = startEvent;
  const document = el.ownerDocument;
  const holds = touchHoldDelay > 0 && startEvent.pointerType === 'touch';

  let cancelled = false;
  let endX = startX;
  let endY = startY;

  const abandon$ = new Subject<void>();

  const end$ = merge(
    merge(fromEvent<PointerEvent>(document, 'pointerup'), fromEvent<PointerEvent>(document, 'pointercancel')).pipe(
      filter((e) => e.pointerId === pointerId),
    ),
    abandon$,
  ).pipe(
    take(1),
    // Read below by the terminating `defer`, which only runs once this has completed the moves.
    tap((e) => {
      cancelled = !e || e.type === 'pointercancel';
      endX = e?.clientX ?? startX;
      endY = e?.clientY ?? startY;
    }),
    share(),
  );

  let lastX = startX;
  let lastY = startY;
  let committed = false;

  const holdPastSlop = (e: PointerEvent) =>
    Math.abs(e.clientX - startX) >= HOLD_SLOP_PX || Math.abs(e.clientY - startY) >= HOLD_SLOP_PX;

  // The host allows panning while a touch holds, so once the hold commits, each touchmove must be cancelled or
  // the browser starts scrolling and takes the pointer away with a pointercancel.
  const hold$: Observable<DragGestureEvent> = holds
    ? timer(touchHoldDelay).pipe(
        concatMap(() => {
          committed = true;
          capturePointer(el, pointerId);

          return concat(
            of<DragGestureEvent>({ type: 'start', data: { clientX: startX, clientY: startY } }),
            merge(
              fromEvent<TouchEvent>(document, 'touchmove', { passive: false }),
              fromEvent<Event>(el, 'contextmenu'),
            ).pipe(
              tap((e) => e.preventDefault()),
              ignoreElements(),
            ),
          );
        }),
      )
    : EMPTY;

  const moves$ = fromEvent<PointerEvent>(document, 'pointermove').pipe(
    filter((e) => e.pointerId === pointerId),
    concatMap((e): Observable<DragGestureEvent> => {
      if (!committed && holds) {
        if (holdPastSlop(e)) abandon$.next();

        return EMPTY;
      }

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
  );

  return defer(() => {
    const releaseSelection = suppressTextSelection(el.ownerDocument);

    return concat(
      merge(hold$, moves$).pipe(takeUntil(end$)),
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
 * With `touchHoldDelay`, a touch must hold still that many ms before the drag starts; a touch that moves
 * first ends on `cancelled` and is left to the browser, so the page can scroll. The host then needs a
 * `touch-action` that allows panning. Mouse and pen are unaffected.
 *
 * This is the primitive behind {@link DragHandleDirective}. Prefer the directive; reach for this when
 * the draggable element belongs to someone else's template (e.g. a table feature attaching a drag to
 * header cells the table itself renders) and you can only work from a delegated `pointerdown`.
 */
export const dragGestureFrom = (
  event: PointerEvent,
  element: HTMLElement,
  options?: { commitThreshold?: number; touchHoldDelay?: number },
): Observable<DragGestureEvent> =>
  setupDragObservable(event, element, options?.commitThreshold ?? 8, options?.touchHoldDelay ?? 0);
