import { TableCellErrorTooltipDirective } from './table-cell-error-tooltip.directive';
import { TableColumnChooserComponent } from './table-column-chooser.component';
import { TableColumnMenuDirective } from './table-column-menu.directive';
import { TableCsvExportDirective } from './table-csv-export.directive';
import { TableFiltersDirective } from './table-filters.directive';
import { TableFooterDirective } from './headless/table-footer.directive';
import { TableReorderDirective } from './table-reorder.directive';
import { TableResizeDirective } from './table-resize.directive';
import { TableSelectionDirective } from './table-selection.directive';
import { TableStatePersistenceDirective } from './headless/table-state-persistence.directive';
import {
  TableCellDirective,
  TableCellSkeletonDirective,
  TableFilterOptionDirective,
  TableFooterCellDirective,
  TableHeaderCellDirective,
} from './headless/table-templates';
import { TableVirtualScrollDirective } from './table-virtual-scroll.directive';
import { TableComponent } from './table.component';

/**
 * The base table: typed rows and cells, the `etTableCell` / `etTableHeaderCell` /
 * `etTableFooterCell` templates, sort headers, sticky columns, the empty state and the footer slot.
 * Deliberately lean — each optional feature ships its own imports array (e.g.
 * {@link TABLE_FILTER_IMPORTS}), so what you don't import stays out of your bundle.
 */
export const TABLE_IMPORTS = [
  TableComponent,
  TableFooterDirective,
  TableCellDirective,
  TableHeaderCellDirective,
  TableFooterCellDirective,
  TableCellSkeletonDirective,
] as const;

/**
 * Filter menus for `filterable` columns (`etTableFilters`), plus the `etTableFilterOption` template for
 * templating an option's content. Pulls in the menu system.
 */
export const TABLE_FILTER_IMPORTS = [TableFiltersDirective, TableFilterOptionDirective] as const;

/**
 * A `⋮` menu of per-column actions in every header cell (`etTableColumnMenu`): sort ascending /
 * descending / clear, reset a resized width, hide the column. Pulls in the menu system — which it
 * shares with {@link TABLE_FILTER_IMPORTS} when both are used.
 */
export const TABLE_COLUMN_MENU_IMPORTS = [TableColumnMenuDirective] as const;

/**
 * A "columns" button + menu for toggling column visibility (`<et-table-column-chooser [table]="…" />`),
 * placed wherever you like. Deliberately separate from the per-column menu — see the component's own
 * docs for why a visibility list must not hang off a header control. Pulls in the menu system.
 */
export const TABLE_COLUMN_CHOOSER_IMPORTS = [TableColumnChooserComponent] as const;

/**
 * Download the table as CSV from a button of your own (`etTableCsvExport`). No extra dependency — the
 * serializer is a pure function you can also call directly ({@link exportTableToCsv}).
 */
export const TABLE_CSV_EXPORT_IMPORTS = [TableCsvExportDirective] as const;

/** Drag-to-resize column widths (`etTableResize`). Pulls in the drag primitives. */
export const TABLE_RESIZE_IMPORTS = [TableResizeDirective] as const;

/** Drag-to-reorder columns (`etTableReorder`), with the drag ghost and drop indicator. */
export const TABLE_REORDER_IMPORTS = [TableReorderDirective] as const;

/** Multi-row selection (`etTableSelection`). Pulls in the checkbox component. */
export const TABLE_SELECTION_IMPORTS = [TableSelectionDirective] as const;

/**
 * Tooltips on failed cells (`etTableCellErrorTooltip`): a `cellState` message is shown on hover/focus
 * rather than as a native `title`. Pulls in the tooltip, and with it the overlay runtime.
 */
export const TABLE_CELL_ERROR_TOOLTIP_IMPORTS = [TableCellErrorTooltipDirective] as const;

/**
 * Persist a table's setup to `localStorage` / `sessionStorage` (`etTableStatePersistence`): column
 * order, visibility, widths, sort, filters, expanded rows and any feature slices. No extra dependency —
 * separate because storing state is a side effect not every table wants.
 */
export const TABLE_STATE_PERSISTENCE_IMPORTS = [TableStatePersistenceDirective] as const;

/** Virtual scrolling (`etTableVirtualScroll`). Pulls in the virtual-window utility. */
export const TABLE_VIRTUAL_SCROLL_IMPORTS = [TableVirtualScrollDirective] as const;
