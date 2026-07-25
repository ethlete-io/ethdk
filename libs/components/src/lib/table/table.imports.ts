import { TableFiltersComponent } from './table-filters.component';
import { TableReorderComponent } from './table-reorder.component';
import { TableSelectionComponent } from './table-selection.component';
import { TableVirtualScrollComponent } from './table-virtual-scroll.component';
import { TableResizeComponent } from './table-resize.component';
import { TableFooterDirective } from './table-footer.directive';
import { TableComponent } from './table.component';

/**
 * The base table: typed rows and cells, sort headers, sticky columns, the empty state and the footer
 * slot. Deliberately lean — each optional feature ships its own imports array (e.g.
 * {@link TABLE_FILTER_IMPORTS}), so what you don't import stays out of your bundle.
 */
export const TABLE_IMPORTS = [TableComponent, TableFooterDirective] as const;

/** Filter menus for `filterable` columns (`<et-table-filters>`). Pulls in the menu system. */
export const TABLE_FILTER_IMPORTS = [TableFiltersComponent] as const;

/** Drag-to-resize column widths (`<et-table-resize>`). Pulls in the drag primitives. */
export const TABLE_RESIZE_IMPORTS = [TableResizeComponent] as const;

/** Drag-to-reorder columns (`<et-table-reorder>`), with the drag ghost and drop indicator. */
export const TABLE_REORDER_IMPORTS = [TableReorderComponent] as const;

/** Multi-row selection (`<et-table-selection>`). Pulls in the checkbox component. */
export const TABLE_SELECTION_IMPORTS = [TableSelectionComponent] as const;

/** Virtual scrolling (`<et-table-virtual-scroll>`). Pulls in the virtual-window utility. */
export const TABLE_VIRTUAL_SCROLL_IMPORTS = [TableVirtualScrollComponent] as const;
