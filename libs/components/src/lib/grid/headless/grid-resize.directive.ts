import { afterNextRender, computed, Directive, ElementRef, inject, Injector, signal } from '@angular/core';
import { injectRenderer, ResizeEdge, ResizeMoveEvent } from '@ethlete/core';
import { GridItemDirective } from './grid-item.directive';
import { GRID_TOKEN } from './grid.tokens';

type Rect = { left: number; top: number; width: number; height: number };

const GROW_THRESHOLD = 0.25;

@Directive({
  selector: '[etGridResize]',
  host: {
    class: 'et-grid-resize',
    '[class.et-grid-resize--active]': 'isResizing()',
  },
})
export class GridResizeDirective {
  private grid = inject(GRID_TOKEN);
  private gridItem = inject(GridItemDirective);
  private injector = inject(Injector);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();

  public isResizing = signal(false);
  public resizeEdges = computed((): ResizeEdge[] => ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']);

  private resizeStartPos = signal<{ col: number; row: number; colSpan: number; rowSpan: number } | null>(null);

  private liftedRect: Rect | null = null;

  private lastSnap: { col: number; row: number; colSpan: number; rowSpan: number } | null = null;

  public beginResize() {
    if (this.grid.readOnly()) return;

    const pos = this.gridItem.currentPosition();

    if (!pos) return;

    this.resizeStartPos.set({ col: pos.col, row: pos.row, colSpan: pos.colSpan, rowSpan: pos.rowSpan });
    this.lastSnap = null;
    this.isResizing.set(true);

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    this.liftedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    this.applyFixed(this.liftedRect);
  }

  public updateResize(event: ResizeMoveEvent) {
    const start = this.resizeStartPos();
    const startRect = this.liftedRect;

    if (!start || !startRect) return;

    const columns = this.grid.activeColumns();
    const containerWidth = this.grid.containerWidth();
    const rowHeight = this.grid.rowHeight();
    const gap = this.grid.gap();

    const cellWidth = (containerWidth - gap * (columns - 1)) / columns;
    const cellHeight = rowHeight + gap;

    // 1. Live pixel size — the item follows the pointer 1:1, clamped to the span
    //    constraints in pixels so it can't grow/shrink past its allowed size.
    const spanWidth = (span: number) => span * cellWidth + (span - 1) * gap;
    const spanHeight = (span: number) => span * rowHeight + (span - 1) * gap;
    const minW = spanWidth(this.gridItem.minColSpan());
    const maxW = spanWidth(this.gridItem.maxColSpan());
    const minH = spanHeight(this.gridItem.minRowSpan());
    const maxH = spanHeight(this.gridItem.maxRowSpan());

    const live: Rect = { ...startRect };

    if (event.edge === 'e' || event.edge === 'se' || event.edge === 'ne') {
      live.width = Math.min(maxW, Math.max(minW, startRect.width + event.dx));
    }
    if (event.edge === 'w' || event.edge === 'sw' || event.edge === 'nw') {
      const rightEdge = startRect.left + startRect.width;
      live.width = Math.min(maxW, Math.max(minW, startRect.width - event.dx));
      live.left = rightEdge - live.width;
    }
    if (event.edge === 's' || event.edge === 'se' || event.edge === 'sw') {
      live.height = Math.min(maxH, Math.max(minH, startRect.height + event.dy));
    }
    if (event.edge === 'n' || event.edge === 'ne' || event.edge === 'nw') {
      const bottomEdge = startRect.top + startRect.height;
      live.height = Math.min(maxH, Math.max(minH, startRect.height - event.dy));
      live.top = bottomEdge - live.height;
    }

    this.applyFixed(live);
    // liftedRect stays the gesture-start anchor — event.dx/dy are cumulative from start.

    // 2. Snapped span — drives neighbour reflow. The snap is biased toward the growth
    //    direction (a cell is claimed once the edge is GROW_THRESHOLD into it) so
    //    neighbours slide out of the way early and the growing item barely overlaps them.
    //    growPos: for edges that grow with a positive delta (east/south).
    //    growNeg: for edges that grow with a negative delta (west/north).
    const growPos = (px: number, cell: number) => Math.floor(px / cell + (1 - GROW_THRESHOLD));
    const growNeg = (px: number, cell: number) => Math.ceil(px / cell - (1 - GROW_THRESHOLD));

    let newColSpan = start.colSpan;
    let newRowSpan = start.rowSpan;
    let newCol = start.col;
    let newRow = start.row;

    if (event.edge === 'e' || event.edge === 'se' || event.edge === 'ne') {
      newColSpan = Math.max(1, start.colSpan + growPos(event.dx, cellWidth));
    }
    if (event.edge === 'w' || event.edge === 'sw' || event.edge === 'nw') {
      const rightEdge = start.col + start.colSpan;
      newCol = Math.max(0, start.col + growNeg(event.dx, cellWidth));
      newColSpan = rightEdge - newCol;
      newColSpan = Math.min(this.gridItem.maxColSpan(), Math.max(this.gridItem.minColSpan(), newColSpan));
      newCol = rightEdge - newColSpan;
    }
    if (event.edge === 's' || event.edge === 'se' || event.edge === 'sw') {
      newRowSpan = Math.max(1, start.rowSpan + growPos(event.dy, cellHeight));
    }
    if (event.edge === 'n' || event.edge === 'ne' || event.edge === 'nw') {
      const bottomEdge = start.row + start.rowSpan;
      newRow = Math.max(0, start.row + growNeg(event.dy, cellHeight));
      newRowSpan = bottomEdge - newRow;
      newRowSpan = Math.min(this.gridItem.maxRowSpan(), Math.max(this.gridItem.minRowSpan(), newRowSpan));
      newRow = bottomEdge - newRowSpan;
    }

    // Gate on the raw snapped target changing — not on the resized item's resolved
    // position (which compaction can shift), so we don't re-run the reflow and restart
    // every neighbour's animation on every pointermove.
    if (
      this.lastSnap &&
      this.lastSnap.colSpan === newColSpan &&
      this.lastSnap.rowSpan === newRowSpan &&
      this.lastSnap.col === newCol &&
      this.lastSnap.row === newRow
    )
      return;

    this.lastSnap = { col: newCol, row: newRow, colSpan: newColSpan, rowSpan: newRowSpan };

    // The snapped span crossed into a new cell: reflow the neighbours. The resized
    // item is excluded from the FLIP because its own fixed element drives the size.
    // A shorter duration than a drag keeps pushed neighbours tracking the live-resizing
    // edge closely during a fast resize, instead of trailing it with a long glide.
    this.grid.snapshotRects();
    this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan, newRowSpan, newCol, newRow });
    this.grid.animateLayoutTransition({ excludeIds: new Set([this.gridItem.itemId()]), durationMs: 160 });
  }

  public finishResize() {
    this.resizeStartPos.set(null);
    this.lastSnap = null;
    this.isResizing.set(false);
    this.grid.commitResize();

    const liveRect = this.liftedRect ? this.currentFixedRect() : null;
    this.liftedRect = null;

    if (!liveRect) {
      this.releaseFixed();

      return;
    }

    // Settle: drop back into grid flow, measure the final slot, then animate the
    // fixed element from its free pixel rect to that slot. Real width/height/left/top
    // are animated (never scale) so the content stays crisp during the settle.
    afterNextRender(
      () => {
        const el = this.elementRef.nativeElement;

        this.releaseFixed();
        const finalRect = el.getBoundingClientRect();
        this.applyFixed({ left: finalRect.left, top: finalRect.top, width: finalRect.width, height: finalRect.height });

        el.getAnimations().forEach((a) => a.cancel());

        const moved = Math.abs(liveRect.left - finalRect.left) > 1 || Math.abs(liveRect.top - finalRect.top) > 1;
        const resized =
          Math.abs(liveRect.width - finalRect.width) > 1 || Math.abs(liveRect.height - finalRect.height) > 1;

        const release = () => this.releaseFixed();

        if (!moved && !resized) {
          release();

          return;
        }

        const anim = el.animate(
          [
            {
              left: `${liveRect.left}px`,
              top: `${liveRect.top}px`,
              width: `${liveRect.width}px`,
              height: `${liveRect.height}px`,
            },
            {
              left: `${finalRect.left}px`,
              top: `${finalRect.top}px`,
              width: `${finalRect.width}px`,
              height: `${finalRect.height}px`,
            },
          ],
          { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
        anim.onfinish = release;
        anim.oncancel = release;
      },
      { injector: this.injector },
    );
  }

  private currentFixedRect(): Rect {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  private applyFixed(rect: Rect) {
    this.renderer.setStyle(this.elementRef.nativeElement, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: '100',
    });
  }

  private releaseFixed() {
    this.renderer.removeStyles(this.elementRef.nativeElement, 'position', 'left', 'top', 'width', 'height', 'zIndex');
  }
}
