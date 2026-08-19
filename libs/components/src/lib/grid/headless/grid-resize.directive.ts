import { DOCUMENT } from '@angular/common';
import { afterNextRender, computed, DestroyRef, Directive, effect, inject, signal, untracked } from '@angular/core';
import { injectHostElement, ResizeEdge, ResizeMoveEvent, RuntimeError } from '@ethlete/core';
import { filter, fromEvent, merge, Subscription, tap } from 'rxjs';
import { GRID_ERROR_CODES } from '../grid-errors';
import { GridItemDirective } from './grid-item.directive';
import { GRID_TOKEN } from './grid.tokens';
import { GridItemPosition } from './grid.types';
import {
  clampResizeRect,
  createAutoScroller,
  findScrollableAncestor,
  positionToPixelRect,
  resizeSpanBounds,
  snapResizeSpan,
} from './internals';

const ALL_RESIZE_EDGES: readonly ResizeEdge[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

@Directive({
  selector: '[etGridResize]',
  host: {
    class: 'et-grid-resize',
    '[class.et-grid-resize--active]': 'isResizing()',
  },
})
export class GridResizeDirective {
  private grid = inject(GRID_TOKEN, { optional: true });
  private gridItem = inject(GridItemDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private hostElement = injectHostElement();

  public isResizing = signal(false);

  /**
   * Only the edges that can actually change a span at the active breakpoint. A strip whose axis is
   * pinned - a column span at a one-column breakpoint, a fixed row span - would still swallow the
   * `pointerdown` that started on it, so dropping it is what hands that part of the item's perimeter
   * back to dragging.
   */
  public resizeEdges = computed((): ResizeEdge[] => {
    const itemId = this.gridItem?.itemId();

    if (!this.grid || !itemId) return [...ALL_RESIZE_EDGES];

    const constraints = this.grid.getConstraints(itemId);
    const horizontal = constraints.maxColSpan > constraints.minColSpan;
    const vertical = constraints.maxRowSpan > constraints.minRowSpan;

    if (horizontal && vertical) return [...ALL_RESIZE_EDGES];
    if (horizontal) return ['e', 'w'];
    if (vertical) return ['n', 's'];

    return [];
  });

  private start: GridItemPosition | null = null;
  private startBreakpoint: string | null = null;
  private lastSnap: GridItemPosition | null = null;
  private lastEvent: ResizeMoveEvent | null = null;
  private startContainerOrigin: { left: number; top: number } | null = null;
  private containerOrigin: { left: number; top: number } | null = null;
  private gestureListeners: Subscription | null = null;

  private autoScroller = createAutoScroller({
    document: this.document,
    getScrollElement: () =>
      (this.grid ? findScrollableAncestor(this.grid.elementRef.nativeElement) : null) ??
      (this.document.scrollingElement as HTMLElement | null),
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.gridItem) {
          throw new RuntimeError(
            GRID_ERROR_CODES.MISSING_GRID_ITEM,
            '[GridResizeDirective] etGridResize must be placed on or inside an [etGridItem] element.',
            { element: this.hostElement },
          );
        }
      });
    }

    effect(() => {
      const readOnly = this.grid?.readOnly() ?? false;
      const breakpoint = this.grid?.activeBreakpoint() ?? null;

      untracked(() => {
        if (!this.start) return;

        if (readOnly || breakpoint !== this.startBreakpoint) {
          this.cancelResize();
        }
      });
    });

    // A same-breakpoint width change re-derives everything (the start rect is computed
    // analytically from the live geometry), so just re-anchor and re-apply.
    effect(() => {
      this.grid?.containerWidth();

      untracked(() => {
        if (!this.start) return;

        this.containerOrigin = this.grid?.getContainerOrigin() ?? null;
        this.applyResize();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.autoScroller.stop();
      this.detachGestureListeners();
    });
  }

  public beginResize() {
    const grid = this.grid;
    const gridItem = this.gridItem;

    if (!grid || !gridItem) return;
    if (grid.readOnly() || !grid.isReady()) return;

    const start = grid.beginResize(gridItem.itemId());

    if (!start) return;

    this.start = start;
    this.startBreakpoint = grid.activeBreakpoint();
    this.lastSnap = start;
    this.lastEvent = null;
    this.startContainerOrigin = grid.getContainerOrigin();
    this.containerOrigin = this.startContainerOrigin;
    this.isResizing.set(true);

    gridItem.startDirectControl();
    this.attachGestureListeners();
  }

  public updateResize(event: ResizeMoveEvent) {
    if (!this.start) return;

    this.lastEvent = event;
    this.autoScroller.start({ clientX: event.clientX, clientY: event.clientY });
    this.autoScroller.update({ clientX: event.clientX, clientY: event.clientY });
    this.applyResize();
  }

  public finishResize() {
    if (!this.start) return;

    // Commit first (layout holds the final slot), then hand rendering back - the box
    // transitions from its live pixel rect to the slot, animating real width/height.
    this.grid?.commitResize();
    this.finishGesture();
  }

  public cancelResize() {
    if (!this.start) return;

    this.grid?.cancelResize();
    this.finishGesture();
  }

  private applyResize() {
    const grid = this.grid;
    const gridItem = this.gridItem;
    const start = this.start;
    const event = this.lastEvent;
    const startOrigin = this.startContainerOrigin;
    const currentOrigin = this.containerOrigin;

    if (!grid || !gridItem || !start || !event || !startOrigin || !currentOrigin) return;

    const geometry = grid.geometry();
    const startRect = positionToPixelRect(start, geometry);
    const bounds = resizeSpanBounds({
      edge: event.edge,
      start,
      constraints: grid.getConstraints(gridItem.itemId()),
      columns: geometry.columns,
    });

    // dx/dy are client-space; shift them into container space so scrolling
    // mid-gesture (including auto-scroll) keeps the box under the pointer.
    const dx = event.dx + (startOrigin.left - currentOrigin.left);
    const dy = event.dy + (startOrigin.top - currentOrigin.top);

    const live = clampResizeRect({ edge: event.edge, dx, dy, startRect, bounds, geometry });
    gridItem.updateDirectRect(live);

    const snap = snapResizeSpan({ edge: event.edge, rect: live, start, bounds, geometry, lastSnap: this.lastSnap });
    this.lastSnap = snap;
    grid.updateResize(gridItem.itemId(), snap);
  }

  private finishGesture() {
    this.gridItem?.stopDirectControl();
    this.isResizing.set(false);
    this.start = null;
    this.startBreakpoint = null;
    this.lastSnap = null;
    this.lastEvent = null;
    this.startContainerOrigin = null;
    this.containerOrigin = null;
    this.autoScroller.stop();
    this.detachGestureListeners();
  }

  private attachGestureListeners() {
    // Captures scroll on any ancestor during an active drag-resize gesture to recompute the
    // container origin - this is document-wide gesture tracking, not a component scroll container,
    // so signalElementScrollState / signalHostElementScrollState don't apply.
    // eslint-disable-next-line ethlete/prefer-scroll-state
    const scroll$ = fromEvent(this.document, 'scroll', { capture: true, passive: true }).pipe(
      tap(() => {
        if (!this.start) return;

        this.containerOrigin = this.grid?.getContainerOrigin() ?? null;
        this.applyResize();
      }),
    );

    const escape$ = fromEvent<KeyboardEvent>(this.document, 'keydown').pipe(
      filter((event) => event.key === 'Escape'),
      tap(() => this.cancelResize()),
    );

    this.gestureListeners?.unsubscribe();
    this.gestureListeners = merge(scroll$, escape$).subscribe();
  }

  private detachGestureListeners() {
    this.gestureListeners?.unsubscribe();
    this.gestureListeners = null;
  }
}
