import { Component, signal, TemplateRef, ViewEncapsulation, viewChild } from '@angular/core';
import { DragHandleDirective, DragMoveEvent } from '@ethlete/core';
import { injectTableFeatureHost, TableColumnMeta, TableHeaderAdornmentContext } from './table-features';

/**
 * Opt-in column resizing for `et-table`: adds a grip to every header cell's trailing edge that drags
 * the column's width, with a double-click to reset it. Place it inside the table — it renders nothing
 * itself, it registers its grip with the table's header cells.
 *
 * Widths live on the table (`state()`'s `TableColumnState.width`), so they survive reordering and
 * round-trip through `restoreState()` — even in a table that never imported this feature.
 *
 * @example
 * <et-table [data]="rows()" [columns]="columns">
 *   <et-table-resize />
 * </et-table>
 */
@Component({
  selector: 'et-table-resize',
  templateUrl: './table-resize.component.html',
  styleUrl: './table-resize.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DragHandleDirective],
})
export class TableResizeComponent {
  public table = injectTableFeatureHost('et-table-resize');

  // The grip, handed to the table to render inside each header cell.
  private adornment = viewChild<TemplateRef<TableHeaderAdornmentContext>>('resizeAdornment');

  // The column being dragged, with the width it had when the drag began — every move applies the
  // pointer's cumulative delta to that baseline, so the column can't drift over a long drag.
  private resizing = signal<{ key: string; startWidth: number } | null>(null);

  constructor() {
    // Renders after the filter trigger: the grip is absolutely positioned at the cell's edge.
    this.table.registerHeaderAdornment({ template: this.adornment, order: 10 });
  }

  protected start(column: TableColumnMeta) {
    this.resizing.set({ key: column.key, startWidth: this.table.renderedColumnWidth(column.key) });
  }

  protected update(event: DragMoveEvent) {
    const resizing = this.resizing();

    if (!resizing) return;

    // The table clamps to a usable minimum and its own width.
    this.table.setColumnWidth(resizing.key, Math.round(resizing.startWidth + event.totalDx));
  }

  protected end() {
    this.resizing.set(null);
  }

  protected reset(column: TableColumnMeta) {
    this.table.resetColumnWidth(column.key);
  }
}
