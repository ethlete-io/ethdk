import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, Directive, effect, ElementRef, inject, untracked } from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DragHandleDirective, DragMoveEvent, DragStartEvent, RuntimeError } from '@ethlete/core';
import { filter, fromEvent, merge, Subscription, tap } from 'rxjs';
import { GRID_ERROR_CODES } from '../grid-errors';
import { GridItemDirective } from './grid-item.directive';
import { GRID_TOKEN } from './grid.tokens';
import { GridItemPosition } from './grid.types';
import {
  computeGridHeight,
  createAutoScroller,
  findScrollableAncestor,
  positionToPixelRect,
  projectDragCell,
  rowsToPixelHeight,
} from './internals';

@Directive({
  selector: '[etGridDrag]',
  hostDirectives: [
    {
      directive: DragHandleDirective,
      outputs: ['dragStarted', 'dragMoved', 'dragEnded'],
    },
  ],
  host: {
    class: 'et-grid-drag',
    '[class.et-grid-drag--active]': '!grid?.readOnly() && dragHandle.isDragging()',
    '[attr.aria-grabbed]': '!grid?.readOnly() && dragHandle.isDragging()',
    // Re-states the drag handle's touch-action lock with read-only awareness: a read-only grid
    // is plain scrollable content. Must bind a concrete value in both states - this binding
    // outranks the host directive's, and a null here clears the property instead of delegating.
    '[style.touch-action]': "grid?.readOnly() ? 'auto' : 'none'",
  },
})
export class GridDragDirective {
  protected grid = inject(GRID_TOKEN, { optional: true });
  private gridItem = inject(GridItemDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  public dragHandle = inject(DragHandleDirective);

  private origin: GridItemPosition | null = null;
  private startBreakpoint: string | null = null;
  private grabOffset: { x: number; y: number } | null = null;
  private containerOrigin: { left: number; top: number } | null = null;
  private lastPointer: { clientX: number; clientY: number } | null = null;
  private lastTarget: { col: number; row: number } | null = null;
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
            '[GridDragDirective] etGridDrag must be placed on or inside an [etGridItem] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }

    outputToObservable(this.dragHandle.dragStarted)
      .pipe(
        tap((event) => this.startDrag(event)),
        takeUntilDestroyed(),
      )
      .subscribe();

    outputToObservable(this.dragHandle.dragMoved)
      .pipe(
        tap((event) => this.trackDragMove(event)),
        takeUntilDestroyed(),
      )
      .subscribe();

    outputToObservable(this.dragHandle.dragEnded)
      .pipe(
        tap(() => this.settleDrag()),
        takeUntilDestroyed(),
      )
      .subscribe();

    outputToObservable(this.dragHandle.dragCancelled)
      .pipe(
        tap(() => this.cancelDrag()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Cancel when the gesture's frame of reference breaks mid-drag: readOnly flips on,
    // or a breakpoint switch invalidates the origin position and column count.
    effect(() => {
      const readOnly = this.grid?.readOnly() ?? false;
      const breakpoint = this.grid?.activeBreakpoint() ?? null;

      untracked(() => {
        if (!this.origin) return;

        if (readOnly || breakpoint !== this.startBreakpoint) {
          this.cancelDrag();
        }
      });
    });

    // A plain width change (e.g. a scrollbar appearing because the grid grew) keeps the
    // breakpoint - re-anchor and re-project instead of cancelling.
    effect(() => {
      this.grid?.containerWidth();

      untracked(() => {
        if (!this.origin) return;

        this.containerOrigin = this.grid?.getContainerOrigin() ?? null;
        this.applyPointer();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.autoScroller.stop();
      this.detachGestureListeners();
    });
  }

  private startDrag(event: DragStartEvent) {
    const grid = this.grid;
    const gridItem = this.gridItem;

    if (!grid || !gridItem) return;
    if (grid.readOnly() || !grid.isReady()) return;

    const origin = grid.beginDrag(gridItem.itemId());

    if (!origin) return;

    // Measure the VISUAL rect (translate included) - correct even when the item is
    // grabbed mid-settle. Between pointerdown and the commit threshold nothing moves,
    // so pointerdown coords against this rect give the exact grab offset.
    const itemRect = this.elementRef.nativeElement.getBoundingClientRect();

    this.grabOffset = {
      x: Math.min(Math.max(event.clientX - itemRect.left, 0), itemRect.width),
      y: Math.min(Math.max(event.clientY - itemRect.top, 0), itemRect.height),
    };
    this.containerOrigin = grid.getContainerOrigin();
    this.lastPointer = { clientX: event.clientX, clientY: event.clientY };
    this.origin = origin;
    this.startBreakpoint = grid.activeBreakpoint();
    this.lastTarget = { col: origin.col, row: origin.row };

    gridItem.startDirectControl();
    this.attachGestureListeners();
    this.autoScroller.start(this.lastPointer);
  }

  private trackDragMove(event: DragMoveEvent) {
    if (!this.origin) return;

    this.lastPointer = { clientX: event.clientX, clientY: event.clientY };
    this.autoScroller.update(this.lastPointer);
    this.applyPointer();
  }

  private applyPointer() {
    const grid = this.grid;
    const origin = this.origin;
    const grabOffset = this.grabOffset;
    const containerOrigin = this.containerOrigin;
    const pointer = this.lastPointer;

    if (!grid || !origin || !grabOffset || !containerOrigin || !pointer) return;

    const geometry = grid.geometry();
    const size = positionToPixelRect(origin, geometry);

    const pointerInContainer = {
      x: pointer.clientX - containerOrigin.left,
      y: pointer.clientY - containerOrigin.top,
    };

    // Clamp the float to the grid bounds. Horizontally the item can never leave the
    // container; vertically its top can reach the current content bottom (so it can
    // still be dropped onto a new last row). Without this the floating item creates
    // page overflow, which feeds the auto-scroller ever more room to scroll into.
    const contentHeight = rowsToPixelHeight(computeGridHeight(grid.layout()), geometry);
    const maxX = geometry.originX + Math.max(0, geometry.contentWidth - size.width);
    const maxY = geometry.originY + contentHeight;

    const float = {
      x: Math.min(Math.max(pointerInContainer.x - grabOffset.x, geometry.originX), maxX),
      y: Math.min(Math.max(pointerInContainer.y - grabOffset.y, geometry.originY), maxY),
    };

    // Re-anchor the grab offset whenever the clamp engaged: the anchor slides along the
    // item so pointer overshoot beyond the grid never accumulates - the moment the
    // pointer reverses, the item moves with it instead of waiting for the overshoot
    // distance to be travelled back.
    this.grabOffset = {
      x: Math.min(Math.max(pointerInContainer.x - float.x, 0), size.width),
      y: Math.min(Math.max(pointerInContainer.y - float.y, 0), size.height),
    };

    this.gridItem?.updateDirectRect({ x: float.x, y: float.y, width: size.width, height: size.height });

    const cell = projectDragCell({ float, colSpan: origin.colSpan, geometry, lastTarget: this.lastTarget });
    this.lastTarget = cell;
    grid.updateDragTarget(cell);
  }

  private settleDrag() {
    if (!this.origin) return;

    // Commit first (layout now holds the final slot), then hand rendering back -
    // the item transitions from its current pointer rect straight to that slot.
    this.grid?.commitDrag();
    this.finishGesture();
  }

  private cancelDrag() {
    if (!this.origin) return;

    this.grid?.cancelDrag();
    this.finishGesture();
  }

  private finishGesture() {
    this.gridItem?.stopDirectControl();
    this.origin = null;
    this.startBreakpoint = null;
    this.grabOffset = null;
    this.containerOrigin = null;
    this.lastPointer = null;
    this.lastTarget = null;
    this.autoScroller.stop();
    this.detachGestureListeners();
  }

  private attachGestureListeners() {
    // eslint-disable-next-line ethlete/prefer-scroll-state
    const scroll$ = fromEvent(this.document, 'scroll', { capture: true, passive: true }).pipe(
      tap(() => {
        if (!this.origin) return;

        this.containerOrigin = this.grid?.getContainerOrigin() ?? null;
        this.applyPointer();
      }),
    );

    const escape$ = fromEvent<KeyboardEvent>(this.document, 'keydown').pipe(
      filter((event) => event.key === 'Escape'),
      tap(() => this.cancelDrag()),
    );

    this.gestureListeners?.unsubscribe();
    this.gestureListeners = merge(scroll$, escape$).subscribe();
  }

  private detachGestureListeners() {
    this.gestureListeners?.unsubscribe();
    this.gestureListeners = null;
  }
}
