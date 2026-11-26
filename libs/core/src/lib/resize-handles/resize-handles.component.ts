import { Component, ElementRef, ViewEncapsulation, booleanAttribute, inject, input } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  concat,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  of,
  share,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { suppressTextSelection } from '../utils/text-selection';

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ResizeMoveEvent = {
  edge: ResizeEdge;
  /** Cumulative delta from the pointerdown position. */
  totalDx: number;
  totalDy: number;
  clientX: number;
  clientY: number;
};

const EDGE_CURSORS: Record<ResizeEdge, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

type GestureEvent =
  | { readonly type: 'start'; readonly edge: ResizeEdge }
  | { readonly type: 'move'; readonly data: ResizeMoveEvent }
  | { readonly type: 'end'; readonly data: ResizeMoveEvent }
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

const setupResizeObservable = (
  startEvent: PointerEvent,
  handle: HTMLElement,
  edge: ResizeEdge,
  doc: Document,
): Observable<GestureEvent> => {
  const pointerId = startEvent.pointerId;
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;

  let cancelled = false;
  let last: ResizeMoveEvent = { edge, totalDx: 0, totalDy: 0, clientX: startX, clientY: startY };

  const end$ = merge(fromEvent<PointerEvent>(doc, 'pointerup'), fromEvent<PointerEvent>(doc, 'pointercancel')).pipe(
    filter((e) => e.pointerId === pointerId),
    take(1),
    // Read below by the terminating `defer`, which only runs once this has completed the moves.
    tap((e) => (cancelled = e.type === 'pointercancel')),
  );

  return defer(() => {
    const releaseSelection = suppressTextSelection(doc);
    capturePointer(handle, pointerId);

    return concat(
      of<GestureEvent>({ type: 'start', edge }),
      fromEvent<PointerEvent>(doc, 'pointermove').pipe(
        filter((e) => e.pointerId === pointerId),
        map((e): GestureEvent => {
          last = {
            edge,
            totalDx: e.clientX - startX,
            totalDy: e.clientY - startY,
            clientX: e.clientX,
            clientY: e.clientY,
          };
          return { type: 'move', data: last };
        }),
        takeUntil(end$),
      ),
      defer((): Observable<GestureEvent> => of(cancelled ? { type: 'cancelled' } : { type: 'end', data: last })),
    ).pipe(finalize(releaseSelection));
  });
};

@Component({
  selector: 'et-resize-handles',
  template: `
    @for (edge of edges(); track edge) {
      <div
        [style.cursor]="edgeCursors[edge]"
        (pointerdown)="startResizeGesture($event, edge)"
        class="et-resize-handle et-resize-handle--{{ edge }}"
      ></div>
    }
  `,
  styleUrl: './resize-handles.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-resize-handles',
    '[attr.inert]': 'disabled() ? "" : null',
    '[attr.data-active-edge]': 'activeEdge()',
  },
})
export class ResizeHandlesComponent {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  edges = input<ResizeEdge[]>(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  disabled = input(false, { transform: booleanAttribute });

  private gestureStart$ = new Subject<{
    readonly event: PointerEvent;
    readonly handle: HTMLElement;
    readonly edge: ResizeEdge;
  }>();

  private gesture$ = this.gestureStart$.pipe(
    exhaustMap(({ event, handle, edge }) =>
      setupResizeObservable(event, handle, edge, this.el.nativeElement.ownerDocument),
    ),
    share(),
    takeUntilDestroyed(),
  );

  resizeStarted = outputFromObservable<ResizeEdge>(
    this.gesture$.pipe(
      filter((e): e is Extract<GestureEvent, { type: 'start' }> => e.type === 'start'),
      map((e) => e.edge),
    ),
  );

  resizeMoved = outputFromObservable<ResizeMoveEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<GestureEvent, { type: 'move' }> => e.type === 'move'),
      map((e) => e.data),
    ),
  );

  resizeEnded = outputFromObservable<ResizeMoveEvent>(
    this.gesture$.pipe(
      filter((e): e is Extract<GestureEvent, { type: 'end' }> => e.type === 'end'),
      map((e) => e.data),
    ),
  );

  /**
   * The browser took the gesture away mid-resize (a system gesture, an incoming call, the tab going
   * to the background). Revert to the size the resize started from - the user never let go, so there
   * is no size they chose.
   */
  resizeCancelled = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'cancelled'),
      map(() => undefined),
    ),
  );

  isResizing = toSignal(
    this.gesture$.pipe(
      map((e) => e.type === 'start' || e.type === 'move'),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  activeEdge = toSignal<ResizeEdge | null>(
    this.gesture$.pipe(
      map((e) => {
        if (e.type === 'start') return e.edge;
        if (e.type === 'move') return e.data.edge;

        return null;
      }),
      distinctUntilChanged(),
    ),
    { initialValue: null },
  );

  protected readonly edgeCursors = EDGE_CURSORS;

  protected startResizeGesture(event: PointerEvent, edge: ResizeEdge) {
    if (event.button !== 0 || this.disabled()) return;
    event.stopPropagation();
    this.gestureStart$.next({ event, handle: event.currentTarget as HTMLElement, edge });
  }
}
