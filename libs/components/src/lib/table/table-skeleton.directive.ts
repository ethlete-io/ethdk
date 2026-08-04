import { afterEveryRender, computed, Directive, inject, Injector, input, signal, untracked } from '@angular/core';
import { SkeletonItemComponent } from '../skeleton/skeleton-item.component';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableSkeletonRowsComponent } from './table-skeleton-rows.component';

/** Options for {@link TableSkeletonDirective}. */
export type TableSkeletonConfig = TableFeatureConfig & {
  /** How many placeholder rows to draw while loading with no rows yet. @default 5 */
  rows?: number;
};

/**
 * Opt-in loading placeholders for `et-table`: the body becomes a block of skeleton rows while the table
 * is loading with nothing to show yet, and a cell that is loading on its own (see the table's
 * `cellState`) shows a bone in place of its value.
 *
 * It carries the [skeleton](/components/skeleton) component with it, which is why it is separate: a table
 * that never draws a placeholder never pulls that in. Without it a first load leaves the body blank -
 * the host's `aria-busy` and the busy bar over existing rows are part of the base.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" [loading]="loading()" etTableSkeleton />
 */
@Directive({
  selector: '[etTableSkeleton]',
  exportAs: 'etTableSkeleton',
})
export class TableSkeletonDirective {
  private table = injectTableFeatureHost('etTableSkeleton');

  /** See {@link TableSkeletonConfig}. */
  public config = input({} as TableSkeletonConfig, {
    alias: 'etTableSkeleton',
    transform: tableFeatureConfig<TableSkeletonConfig>,
  });

  /**
   * The height of a real row, remembered from the last time this table had any, so a refetch or a page
   * change keeps the table exactly as tall as the data the user was just looking at. `null` until a row
   * has been rendered - a first load has nothing to measure, which is what `etTableCellSkeleton` is for.
   */
  public measuredRowHeight = signal<number | null>(null);

  constructor() {
    const enabled = computed(() => this.config().enabled ?? true);

    this.table.registerBodyPlaceholder({
      component: TableSkeletonRowsComponent,
      injector: inject(Injector),
      enabled,
    });

    // `shape` already defaults to `text`, so the bone needs no wrapper of its own - the cell lays it out
    // as a flex child, which is what stretches it to the cell's inline size.
    this.table.registerCellPlaceholder({ component: SkeletonItemComponent, enabled });

    // Measured from a rendered body cell (a row is `display: contents` and has no box of its own)
    // whenever the render changes - cheap, and the only way to know a row's height when its cells hold
    // arbitrary content.
    afterEveryRender(() => {
      const cell = this.table.firstBodyCellElement();

      if (!cell) return;

      const height = Math.round(cell.getBoundingClientRect().height);

      if (height > 0 && height !== untracked(this.measuredRowHeight)) this.measuredRowHeight.set(height);
    });
  }
}
