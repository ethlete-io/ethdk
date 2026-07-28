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
} as const;
