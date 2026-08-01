import { computed, Directive, inject, Injector, input, signal } from '@angular/core';
import { DragMoveEvent } from '@ethlete/core';
import {
  injectTableFeatureHost,
  TableColumnMeta,
  TableFeatureConfig,
  tableFeatureConfig,
} from './headless/table-features';
import { TableResizeGripComponent } from './table-resize-grip.component';

/** Options for {@link TableResizeDirective}. */
export type TableResizeConfig = TableFeatureConfig;

/**
 * Opt-in column resizing for `et-table`: adds a grip to every header cell's trailing edge that drags
 * the column's width, with a double-click to reset it.
 *
 * Widths live on the table (`state()`'s `TableColumnState.width`), so they survive reordering and
 * round-trip through `restoreState()` - even in a table that never imported this feature.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableResize />
 */
@Directive({
  selector: '[etTableResize]',
  exportAs: 'etTableResize',
})
export class TableResizeDirective {
  public table = injectTableFeatureHost('etTableResize');

  /** See {@link TableResizeConfig}. */
  public config = input({} as TableResizeConfig, {
    alias: 'etTableResize',
    transform: tableFeatureConfig<TableResizeConfig>,
  });

  // The column being dragged, with the width it had when the drag began - every move applies the
  // pointer's cumulative delta to that baseline, so the column can't drift over a long drag.
  private resizing = signal<{ key: string; startWidth: number } | null>(null);

  constructor() {
    // Renders after the filter trigger: the grip is absolutely positioned at the cell's edge.
    this.table.registerHeaderAdornment({
      component: TableResizeGripComponent,
      injector: inject(Injector),
      order: 10,
      // A lone column has nothing to trade width with - it already spans the table - so the grip
      // would only ever push the layout into overflow or leave a gap. Hide it until there are two.
      enabled: computed(() => (this.config().enabled ?? true) && this.table.visibleColumnsMeta().length > 1),
    });
  }

  public start(column: TableColumnMeta) {
    this.resizing.set({ key: column.key, startWidth: this.table.renderedColumnWidth(column.key) });
  }

  public update(event: DragMoveEvent) {
    const resizing = this.resizing();

    if (!resizing) return;

    // The table clamps to a usable minimum and its own width.
    this.table.setColumnWidth(resizing.key, Math.round(resizing.startWidth + event.totalDx));
  }

  public end() {
    this.resizing.set(null);
  }

  public reset(column: TableColumnMeta) {
    this.table.resetColumnWidth(column.key);
  }
}
