// codes 3500-3599
// 3500 is retired: it was a duplicate-column-key check, which the keyed `TableColumns` record
// makes impossible by construction.
export const TABLE_ERROR_CODES = {
  /** An opt-in table feature (e.g. `etTableFilters`) was used outside an `<et-table>`. */
  FEATURE_OUTSIDE_TABLE: 3501,
  /** Two features tried to window the rendered rows (e.g. two virtual-scroll components). */
  DUPLICATE_ROW_WINDOW: 3502,
  /** An `etTableCell` (or header/footer) template was used outside an `<et-table>`. */
  TEMPLATE_OUTSIDE_TABLE: 3503,
  /** A column template was bound to a column that this table's `columns` record doesn't contain. */
  UNKNOWN_TEMPLATE_COLUMN: 3504,
  /** A CSV export named a column key the table doesn't declare. */
  UNKNOWN_EXPORT_COLUMN: 3505,
  /** A CSV export would write fewer rows than the table's source says exist - see `partial`. */
  PARTIAL_EXPORT: 3506,
  /** A CSV export was given both a server-built `file` and options that only apply to a built one. */
  CONFLICTING_EXPORT_OPTIONS: 3507,
  /** An `expandedRowTemplate` was set on a table without `etTableRowExpansion` to render it. */
  MISSING_ROW_EXPANSION: 3508,
  /** A `rowLink` answered with router commands on a table without `etTableRowRouterLink` to resolve them. */
  MISSING_ROW_ROUTER_LINK: 3509,
} as const;
