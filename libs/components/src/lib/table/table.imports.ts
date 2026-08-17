import { TableCellErrorTooltipDirective } from './table-cell-error-tooltip.directive';
import { TableColumnChooserComponent } from './table-column-chooser.component';
import { TableColumnMenuDirective } from './table-column-menu.directive';
import { TableCsvExportDirective } from './table-csv-export.directive';
import { TableDragScrollDirective } from './table-drag-scroll.directive';
import { TableFiltersDirective } from './table-filters.directive';
import { TableGroupHeadersDirective } from './table-group-headers.directive';
import { TableFooterDirective } from './headless/table-footer.directive';
import { TableInlineEditDirective } from './table-inline-edit.directive';
import { TableKeyboardNavDirective } from './table-keyboard-nav.directive';
import { TablePageStickyHeaderDirective } from './table-page-sticky-header.directive';
import { TableReorderDirective } from './table-reorder.directive';
import { TableRowExpansionDirective } from './table-row-expansion.directive';
import { TableRowRouterLinkDirective } from './table-row-router-link.directive';
import { TableResizeDirective } from './table-resize.directive';
import { TableSelectionDirective } from './table-selection.directive';
import { TableSkeletonDirective } from './table-skeleton.directive';
import { TableStickyColumnsDirective } from './table-sticky-columns.directive';
import { TableStatePersistenceDirective } from './headless/table-state-persistence.directive';
import {
  TableCellDirective,
  TableCellEditDirective,
  TableCellSkeletonDirective,
  TableFilterOptionDirective,
  TableFooterCellDirective,
  TableHeaderCellDirective,
} from './headless/table-templates';
import { TableVirtualScrollDirective } from './table-virtual-scroll.directive';
import { TableComponent } from './table.component';

/**
 * The base table: typed rows and cells, the `etTableCell` / `etTableHeaderCell` /
 * `etTableFooterCell` templates, sort headers, the empty state and the footer slot.
 * Deliberately lean - each optional feature ships its own imports array (e.g.
 * {@link TABLE_FILTER_IMPORTS}), so what you don't import stays out of your bundle.
 *
 * Row expansion, grouped headers, loading placeholders and sticky columns are **not** in here - see
 * {@link TABLE_ROW_EXPANSION_IMPORTS}, {@link TABLE_GROUP_HEADERS_IMPORTS},
 * {@link TABLE_SKELETON_IMPORTS} and {@link TABLE_STICKY_COLUMNS_IMPORTS}.
 */
export const TABLE_IMPORTS = [
  TableComponent,
  TableFooterDirective,
  TableCellDirective,
  TableHeaderCellDirective,
  TableFooterCellDirective,
] as const;

/**
 * Filter menus for `filterable` columns (`etTableFilters`), plus the `etTableFilterOption` template for
 * templating an option's content. Pulls in the menu system.
 */
export const TABLE_FILTER_IMPORTS = [TableFiltersDirective, TableFilterOptionDirective] as const;

/**
 * A `⋮` menu of per-column actions in every header cell (`etTableColumnMenu`): sort ascending /
 * descending / clear, reset a resized width, hide the column. Pulls in the menu system - which it
 * shares with {@link TABLE_FILTER_IMPORTS} when both are used.
 */
export const TABLE_COLUMN_MENU_IMPORTS = [TableColumnMenuDirective] as const;

/**
 * A "columns" button + menu for toggling column visibility (`<et-table-column-chooser [table]="…" />`),
 * placed wherever you like. Deliberately separate from the per-column menu - see the component's own
 * docs for why a visibility list must not hang off a header control. Pulls in the menu system.
 */
export const TABLE_COLUMN_CHOOSER_IMPORTS = [TableColumnChooserComponent] as const;

/**
 * Download the table as CSV from a button of your own (`etTableCsvExport`). No extra dependency - the
 * serializer is a pure function you can also call directly ({@link exportTableToCsv}).
 */
export const TABLE_CSV_EXPORT_IMPORTS = [TableCsvExportDirective] as const;

/**
 * Arrow-key navigation over the body's cells (`etTableKeyboardNav`), following the ARIA grid pattern:
 * the body becomes one tab stop. No extra dependency.
 */
export const TABLE_KEYBOARD_NAV_IMPORTS = [TableKeyboardNavDirective] as const;

/**
 * Inline cell editing (`etTableInlineEdit`), plus the `etTableCellEdit` template that supplies a
 * column's editor. No extra dependency of its own - the editor is whichever control you put in the
 * template. Pair it with {@link TABLE_KEYBOARD_NAV_IMPORTS} for the `Enter`-to-edit flow.
 */
export const TABLE_INLINE_EDIT_IMPORTS = [TableInlineEditDirective, TableCellEditDirective] as const;

/** Drag-to-resize column widths (`etTableResize`). Pulls in the drag primitives. */
export const TABLE_RESIZE_IMPORTS = [TableResizeDirective] as const;

/**
 * Drag-to-scroll (`etTableDragScroll`): pressing in the table and dragging pans it, so a wide table is
 * reachable without the scrollbar. Pulls in the drag primitives - which it shares with
 * {@link TABLE_RESIZE_IMPORTS} and {@link TABLE_REORDER_IMPORTS} when those are used too.
 */
export const TABLE_DRAG_SCROLL_IMPORTS = [TableDragScrollDirective] as const;

/** Drag-to-reorder columns (`etTableReorder`), with the drag ghost and drop indicator. */
export const TABLE_REORDER_IMPORTS = [TableReorderDirective] as const;

/** Multi-row selection (`etTableSelection`). Pulls in the checkbox component. */
export const TABLE_SELECTION_IMPORTS = [TableSelectionDirective] as const;

/**
 * Grouped column headers (`etTableGroupHeaders`): a spanning row above the column headers in which
 * adjacent columns sharing a `group` read under one label. Carries that row and its chrome.
 */
export const TABLE_GROUP_HEADERS_IMPORTS = [TableGroupHeadersDirective] as const;

/**
 * Sticky columns (`etTableStickyColumns`): a column declaring `sticky: 'start' | 'end'` stays put while
 * the table scrolls horizontally. Carries the measuring of the pinned offsets and the pinned cells'
 * chrome, which is why it is separate - a table that pins nothing measures nothing.
 */
export const TABLE_STICKY_COLUMNS_IMPORTS = [TableStickyColumnsDirective] as const;

/**
 * A viewport-pinned header row (`etTablePageStickyHeader`) for a table the page scrolls rather than the
 * table itself. A table with a height of its own pins its header without any of this.
 */
export const TABLE_PAGE_STICKY_HEADER_IMPORTS = [TablePageStickyHeaderDirective] as const;

/**
 * Loading placeholders (`etTableSkeleton`): a block of skeleton rows while loading with no rows yet, a
 * bone in a cell that is loading on its own, and the `etTableCellSkeleton` template for saying what a
 * column's bone looks like. Pulls in the [skeleton](/components/skeleton) component.
 */
export const TABLE_SKELETON_IMPORTS = [TableSkeletonDirective, TableCellSkeletonDirective] as const;

/**
 * Row expansion (`etTableRowExpansion`): a leading expander column and a full-width detail row for the
 * table's `[expandedRowTemplate]`. Carries the detail row's chrome and its grow-open animation, which is
 * why it is separate - a table that never expands a row pays for none of it.
 */
export const TABLE_ROW_EXPANSION_IMPORTS = [TableRowExpansionDirective] as const;

/**
 * Angular routing for row links (`etTableRowRouterLink`): a `[rowLink]` may then answer with router
 * commands instead of an `href`, and a plain click navigates through the router. Separate because the
 * base table depends on no router - a table linking with plain `href` strings pays for none of it.
 */
export const TABLE_ROW_ROUTER_LINK_IMPORTS = [TableRowRouterLinkDirective] as const;

/**
 * Tooltips on failed cells (`etTableCellErrorTooltip`): a `cellState` message is shown on hover/focus
 * rather than as a native `title`. Pulls in the tooltip, and with it the overlay runtime.
 */
export const TABLE_CELL_ERROR_TOOLTIP_IMPORTS = [TableCellErrorTooltipDirective] as const;

/**
 * Persist a table's setup to `localStorage` / `sessionStorage` (`etTableStatePersistence`): column
 * order, visibility, widths, sort, filters, expanded rows and any feature slices. No extra dependency -
 * separate because storing state is a side effect not every table wants.
 */
export const TABLE_STATE_PERSISTENCE_IMPORTS = [TableStatePersistenceDirective] as const;

/** Virtual scrolling (`etTableVirtualScroll`). Pulls in the virtual-window utility. */
export const TABLE_VIRTUAL_SCROLL_IMPORTS = [TableVirtualScrollDirective] as const;
