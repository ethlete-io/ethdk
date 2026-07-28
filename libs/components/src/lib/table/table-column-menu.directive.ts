import { computed, Directive, inject, Injector, input } from '@angular/core';
import {
  injectTableFeatureHost,
  TableColumnMeta,
  TableFeatureConfig,
  tableFeatureConfig,
} from './headless/table-features';
import { TableColumnMenuTriggerComponent } from './table-column-menu-trigger.component';

/** Options for {@link TableColumnMenuDirective}. */
export type TableColumnMenuConfig = TableFeatureConfig & {
  /** Offer "Autosize this column" / "Autosize all columns". @default true */
  autosize?: boolean;
  /** Offer "Reset width" when the column has been resized. @default true */
  resetWidth?: boolean;
  /** Offer "Hide column". The last visible column can never be hidden. @default true */
  hideColumn?: boolean;
};

/**
 * Opt-in per-column menu for `et-table`: a `⋮` in every header cell opening the column's actions —
 * sort ascending / descending / clear, reset a resized width, hide the column.
 *
 * It carries the menu system, so it is a separate feature: a table without it never pulls that in.
 * (If you also use `etTableFilters`, the two share that cost.)
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableColumnMenu />
 *
 * <!-- with options -->
 * <et-table [etTableColumnMenu]="{ hideColumn: false }" … />
 */
@Directive({
  selector: '[etTableColumnMenu]',
  exportAs: 'etTableColumnMenu',
})
export class TableColumnMenuDirective {
  public table = injectTableFeatureHost('etTableColumnMenu');

  /** See {@link TableColumnMenuConfig}. */
  public config = input({} as TableColumnMenuConfig, {
    alias: 'etTableColumnMenu',
    transform: tableFeatureConfig<TableColumnMenuConfig>,
  });

  constructor() {
    // After the filter trigger (order 0) and before the resize grip (order 10), so the header reads
    // label → filter → menu with the grip still pinned to the very edge.
    this.table.registerHeaderAdornment({
      component: TableColumnMenuTriggerComponent,
      injector: inject(Injector),
      order: 5,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }

  /** Whether the column is sorted, and which way — drives the menu's checked state. */
  public directionOf(column: TableColumnMeta) {
    return this.table.sortDirection(column.key);
  }

  public sortAscending(column: TableColumnMeta) {
    this.table.setSort(column.key, 'asc');
  }

  public sortDescending(column: TableColumnMeta) {
    this.table.setSort(column.key, 'desc');
  }

  public clearSort(column: TableColumnMeta) {
    this.table.setSort(column.key, null);
  }

  public canAutosize() {
    return this.config().autosize ?? true;
  }

  public autosize(column: TableColumnMeta) {
    this.table.autosizeColumns([column.key]);
  }

  public autosizeAll() {
    this.table.autosizeColumns(this.table.visibleColumnsMeta().map((column) => column.key));
  }

  /** Only worth offering once the user has actually resized the column. */
  public canResetWidth(column: TableColumnMeta) {
    return (this.config().resetWidth ?? true) && this.table.hasColumnWidthOverride(column.key);
  }

  public resetWidth(column: TableColumnMeta) {
    this.table.resetColumnWidth(column.key);
  }

  /**
   * Hiding the last visible column would leave a table with no header to un-hide it from — a
   * table-wide condition, so it takes no column.
   */
  public canHide() {
    return (this.config().hideColumn ?? true) && this.table.visibleColumnsMeta().length > 1;
  }

  public hide(column: TableColumnMeta) {
    this.table.setColumnVisible(column.key, false);
  }
}
