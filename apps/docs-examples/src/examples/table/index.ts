export const TABLE_EXAMPLES = {
  'table/table-appearance': () => import('./table-appearance.example').then((m) => m.TableAppearanceExampleComponent),
  'table/table-card-rows': () => import('./table-card-rows.example').then((m) => m.TableCardRowsExampleComponent),
  'table/table-cell-states': () => import('./table-cell-states.example').then((m) => m.TableCellStatesExampleComponent),
  'table/table-column-chooser': () =>
    import('./table-column-chooser.example').then((m) => m.TableColumnChooserExampleComponent),
  'table/table-column-menu': () => import('./table-column-menu.example').then((m) => m.TableColumnMenuExampleComponent),
  'table/table-csv-export': () => import('./table-csv-export.example').then((m) => m.TableCsvExportExampleComponent),
  'table/table-csv-export-beyond-the-page': () =>
    import('./table-csv-export-beyond-the-page.example').then((m) => m.TableCsvExportBeyondThePageExampleComponent),
  'table/table-default': () => import('./table-default.example').then((m) => m.TableDefaultExampleComponent),
  'table/table-errored': () => import('./table-errored.example').then((m) => m.TableErroredExampleComponent),
  'table/table-expandable-sub-table': () =>
    import('./table-expandable-sub-table.example').then((m) => m.TableExpandableSubTableExampleComponent),
  'table/table-grouped-headers': () =>
    import('./table-grouped-headers.example').then((m) => m.TableGroupedHeadersExampleComponent),
  'table/table-inline-editing': () =>
    import('./table-inline-editing.example').then((m) => m.TableInlineEditingExampleComponent),
  'table/table-keyboard-navigation': () =>
    import('./table-keyboard-navigation.example').then((m) => m.TableKeyboardNavigationExampleComponent),
  'table/table-loading': () => import('./table-loading.example').then((m) => m.TableLoadingExampleComponent),
  'table/table-pin-columns-at-runtime': () =>
    import('./table-pin-columns-at-runtime.example').then((m) => m.TablePinColumnsAtRuntimeExampleComponent),
  'table/table-quick-filter': () =>
    import('./table-quick-filter.example').then((m) => m.TableQuickFilterExampleComponent),
  'table/table-row-links': () => import('./table-row-links.example').then((m) => m.TableRowLinksExampleComponent),
  'table/table-shift-multi-sort': () =>
    import('./table-shift-multi-sort.example').then((m) => m.TableShiftMultiSortExampleComponent),
  'table/table-single-select-filter': () =>
    import('./table-single-select-filter.example').then((m) => m.TableSingleSelectFilterExampleComponent),
  'table/table-templated-filter-options': () =>
    import('./table-templated-filter-options.example').then((m) => m.TableTemplatedFilterOptionsExampleComponent),
  'table/table-virtualized': () =>
    import('./table-virtualized.example').then((m) => m.TableVirtualizedExampleComponent),
};
