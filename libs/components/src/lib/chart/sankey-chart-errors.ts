// codes 5160-5179
export const SANKEY_CHART_ERROR_CODES = {
  /** The links of a sankey chart form a cycle, so its nodes cannot be put in left-to-right columns. */
  CYCLE: 5160,
  /** A sankey link names a `source` or `target` that is not the `id` of any node. */
  UNKNOWN_NODE: 5161,
  /** Two sankey nodes share one `id`. */
  DUPLICATE_NODE: 5162,
  /** A sankey link has a negative or non-finite `value`. */
  INVALID_VALUE: 5163,
} as const;
