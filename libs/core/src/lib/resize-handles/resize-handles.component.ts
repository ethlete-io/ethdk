import { ChangeDetectionStrategy, Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  concat,
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

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ResizeMoveEvent = {
  edge: ResizeEdge;
  dx: number;
  dy: number;
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
  | { readonly type: 'end' };

const setupResizeObservable = (startEvent: PointerEvent, edge: ResizeEdge): Observable<GestureEvent> => {
  const pointerId = startEvent.pointerId;
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;

  const end$ = merge(
    fromEvent<PointerEvent>(document, 'pointerup'),
    fromEvent<PointerEvent>(document, 'pointercancel'),
  ).pipe(
    filter((e) => e.pointerId === pointerId),
    take(1),
  );

  return concat(
    of<GestureEvent>({ type: 'start', edge }),
    fromEvent<PointerEvent>(document, 'pointermove').pipe(
      filter((e) => e.pointerId === pointerId),
      map((e): GestureEvent => ({ type: 'move', data: { edge, dx: e.clientX - startX, dy: e.clientY - startY } })),
      takeUntil(end$),
    ),
    of<GestureEvent>({ type: 'end' }),
  );
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    @property --et-resize-handles-z-index {
      syntax: '<integer>';
      inherits: true;
      initial-value: 10;
    }

    @property --et-resize-handles-edge-size {
      syntax: '<length>';
      inherits: true;
      initial-value: 6px;
    }

    @property --et-resize-handles-corner-size {
      syntax: '<length>';
      inherits: true;
      initial-value: 12px;
    }

    @property --et-resize-handles-edge-inset {
      syntax: '<length>';
      inherits: true;
      initial-value: 8px;
    }

    @property --et-resize-handles-side-top {
      syntax: '<length>';
      inherits: true;
      initial-value: 0px;
    }

    @property --et-resize-handles-side-bottom {
      syntax: '<length>';
      inherits: true;
      initial-value: 8px;
    }

    @property --et-resize-handles-touch-edge-size {
      syntax: '<length>';
      inherits: true;
      initial-value: 20px;
    }

    @property --et-resize-handles-touch-corner-size {
      syntax: '<length>';
      inherits: true;
      initial-value: 28px;
    }

    et-resize-handles {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .et-resize-handle {
      position: absolute;
      z-index: var(--et-resize-handles-z-index);
      touch-action: none;
      pointer-events: auto;
    }

    .et-resize-handle--n {
      left: var(--et-resize-handles-edge-inset);
      right: var(--et-resize-handles-edge-inset);
      height: var(--et-resize-handles-edge-size);
      top: 0;
    }

    .et-resize-handle--s {
      left: var(--et-resize-handles-edge-inset);
      right: var(--et-resize-handles-edge-inset);
      height: var(--et-resize-handles-edge-size);
      bottom: 0;
    }

    .et-resize-handle--e,
    .et-resize-handle--w {
      top: var(--et-resize-handles-side-top);
      bottom: var(--et-resize-handles-side-bottom);
      width: var(--et-resize-handles-edge-size);
    }

    .et-resize-handle--e {
      right: 0;
    }

    .et-resize-handle--w {
      left: 0;
    }

    .et-resize-handle--ne,
    .et-resize-handle--nw {
      top: 0;
      width: var(--et-resize-handles-corner-size);
      height: var(--et-resize-handles-corner-size);
    }

    .et-resize-handle--ne {
      right: 0;
    }

    .et-resize-handle--nw {
      left: 0;
    }

    .et-resize-handle--se,
    .et-resize-handle--sw {
      bottom: 0;
      width: var(--et-resize-handles-corner-size);
      height: var(--et-resize-handles-corner-size);
    }

    .et-resize-handle--se {
      right: 0;
    }

    .et-resize-handle--sw {
      left: 0;
    }

    @media (hover: none) {
      .et-resize-handle--n,
      .et-resize-handle--s {
        height: var(--et-resize-handles-touch-edge-size);
      }

      .et-resize-handle--e,
      .et-resize-handle--w {
        width: var(--et-resize-handles-touch-edge-size);
      }

      .et-resize-handle--ne,
      .et-resize-handle--nw,
      .et-resize-handle--se,
      .et-resize-handle--sw {
        width: var(--et-resize-handles-touch-corner-size);
        height: var(--et-resize-handles-touch-corner-size);
      }
    }
  `,
  host: { class: 'et-resize-handles', '[attr.inert]': 'disabled() ? "" : null' },
})
export class ResizeHandlesComponent {
  edges = input<ResizeEdge[]>(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  disabled = input(false, { transform: booleanAttribute });

  private gestureStart$ = new Subject<{ readonly event: PointerEvent; readonly edge: ResizeEdge }>();

  private gesture$ = this.gestureStart$.pipe(
    exhaustMap(({ event, edge }) => setupResizeObservable(event, edge)),
    takeUntilDestroyed(),
    share(),
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

  resizeEnded = outputFromObservable<void>(
    this.gesture$.pipe(
      filter((e) => e.type === 'end'),
      map(() => undefined),
    ),
  );

  isResizing = toSignal(
    this.gesture$.pipe(
      map((e) => e.type !== 'end'),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  readonly edgeCursors = EDGE_CURSORS;

  startResizeGesture(event: PointerEvent, edge: ResizeEdge): void {
    if (event.button !== 0 || this.disabled()) return;
    event.stopPropagation();
    this.gestureStart$.next({ event, edge });
  }
}
