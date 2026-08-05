// codes 4600-4699
export const TREE_ERROR_CODES = {
  /** An `[etTree]` was rendered without a `[dataSource]`, so it has nothing to show. */
  MISSING_DATA_SOURCE: 4600,
  /** A tree part (`etTreeNode`, `etTreeNodeDef`) was used outside an `[etTree]`. */
  PART_OUTSIDE_TREE: 4601,
} as const;
