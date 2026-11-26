import { InjectionToken } from '@angular/core';
import { TableCellErrorTooltipDirective } from './table-cell-error-tooltip.directive';
import { TableColumnMenuDirective } from './table-column-menu.directive';
import { TableFiltersDirective } from './table-filters.directive';
import { TableGroupHeadersDirective } from './table-group-headers.directive';
import { TableReorderDirective } from './table-reorder.directive';
import { TableResizeDirective } from './table-resize.directive';
import { TableRowExpansionDirective } from './table-row-expansion.directive';
import { TableSelectionDirective } from './table-selection.directive';
import { TableSkeletonDirective } from './table-skeleton.directive';

export const TABLE_CELL_ERROR_TOOLTIP_TOKEN = new InjectionToken<TableCellErrorTooltipDirective>(
  'TABLE_CELL_ERROR_TOOLTIP_TOKEN',
);
export const TABLE_COLUMN_MENU_TOKEN = new InjectionToken<TableColumnMenuDirective>('TABLE_COLUMN_MENU_TOKEN');
export const TABLE_FILTERS_TOKEN = new InjectionToken<TableFiltersDirective>('TABLE_FILTERS_TOKEN');
export const TABLE_GROUP_HEADERS_TOKEN = new InjectionToken<TableGroupHeadersDirective>('TABLE_GROUP_HEADERS_TOKEN');
export const TABLE_REORDER_TOKEN = new InjectionToken<TableReorderDirective>('TABLE_REORDER_TOKEN');
export const TABLE_RESIZE_TOKEN = new InjectionToken<TableResizeDirective>('TABLE_RESIZE_TOKEN');
export const TABLE_ROW_EXPANSION_TOKEN = new InjectionToken<TableRowExpansionDirective<unknown>>(
  'TABLE_ROW_EXPANSION_TOKEN',
);
export const TABLE_SELECTION_TOKEN = new InjectionToken<TableSelectionDirective<unknown>>('TABLE_SELECTION_TOKEN');
export const TABLE_SKELETON_TOKEN = new InjectionToken<TableSkeletonDirective>('TABLE_SKELETON_TOKEN');
