// codes 3500-3599
export const TABLE_ERROR_CODES = {
  /** Two columns share the same `key`. Keys must be unique for state serialization. */
  DUPLICATE_COLUMN_KEY: 3500,
  /** An opt-in table feature (e.g. `<et-table-filters>`) was used outside an `<et-table>`. */
  FEATURE_OUTSIDE_TABLE: 3501,
  /** Two features tried to window the rendered rows (e.g. two virtual-scroll components). */
  DUPLICATE_ROW_WINDOW: 3502,
} as const;
