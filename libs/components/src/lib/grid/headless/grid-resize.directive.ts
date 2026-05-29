import { Directive, computed, inject, signal } from '@angular/core';
import { ResizeEdge, ResizeMoveEvent } from '@ethlete/core';
import { GridItemDirective } from './grid-item.directive';
import { GRID_TOKEN } from './grid.tokens';

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

  public isResizing = signal(false);
  public resizeEdges = computed((): ResizeEdge[] => ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']);

  private resizeStartPos = signal<{ col: number; row: number; colSpan: number; rowSpan: number } | null>(null);

  public onResizeStarted() {
    const pos = this.gridItem.currentPosition();

    if (pos) {
      this.resizeStartPos.set({ col: pos.col, row: pos.row, colSpan: pos.colSpan, rowSpan: pos.rowSpan });
      this.isResizing.set(true);
    }
  }

  public onResizeMoved(event: ResizeMoveEvent) {
    const start = this.resizeStartPos();

    if (!start) return;

    const columns = this.grid.activeColumns();
    const containerWidth = this.grid.containerWidth();
    const rowHeight = this.grid.rowHeight();
    const gap = this.grid.gap();

    const cellWidth = (containerWidth - gap * (columns - 1)) / columns;
    const cellHeight = rowHeight + gap;

    let newColSpan = start.colSpan;
    let newRowSpan = start.rowSpan;
    let newCol = start.col;
    let newRow = start.row;

    // East edges: grow/shrink span to the right
    if (event.edge === 'e' || event.edge === 'se' || event.edge === 'ne') {
      newColSpan = Math.max(1, start.colSpan + Math.round(event.dx / cellWidth));
    }

    // West edges: move col left and grow span
    if (event.edge === 'w' || event.edge === 'sw' || event.edge === 'nw') {
      const colDelta = Math.round(event.dx / cellWidth);
      newCol = Math.max(0, start.col + colDelta);
      newColSpan = Math.max(1, start.colSpan - (newCol - start.col));
    }

    // South edges: grow/shrink span downward
    if (event.edge === 's' || event.edge === 'se' || event.edge === 'sw') {
      newRowSpan = Math.max(1, start.rowSpan + Math.round(event.dy / cellHeight));
    }

    // North edges: move row up and grow span
    if (event.edge === 'n' || event.edge === 'ne' || event.edge === 'nw') {
      const rowDelta = Math.round(event.dy / cellHeight);
      newRow = Math.max(0, start.row + rowDelta);
      newRowSpan = Math.max(1, start.rowSpan - (newRow - start.row));
    }

    const currentPos = this.gridItem.currentPosition();

    if (
      currentPos &&
      currentPos.colSpan === newColSpan &&
      currentPos.rowSpan === newRowSpan &&
      currentPos.col === newCol &&
      currentPos.row === newRow
    )
      return;

    this.grid.snapshotRects();
    this.grid.resizeItem({ id: this.gridItem.itemId(), newColSpan, newRowSpan, newCol, newRow });
    this.grid.animateLayoutTransition({ scaleIds: new Set([this.gridItem.itemId()]) });
  }

  public onResizeEnded() {
    this.resizeStartPos.set(null);
    this.isResizing.set(false);
    this.grid.commitResize();
  }
}
