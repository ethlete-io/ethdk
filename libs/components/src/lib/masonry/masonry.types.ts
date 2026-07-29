/** Where one item sits: which column it landed in, and its offset from the container's start corner. */
export type MasonryPlacement = {
  column: number;
  /** Offset along the inline axis (left in LTR, right in RTL — CSS resolves the side). */
  inlineOffset: number;
  /** Offset along the block axis, i.e. how tall the column was when this item was placed. */
  blockOffset: number;
};

/** The column grid a masonry has settled on for its current width. */
export type MasonryColumns = {
  /** `0` means the container has not been measured yet, so nothing can be placed. */
  count: number;
  inlineSize: number;
};

/** The result of one packing pass. */
export type MasonryPacking = {
  /** Index-aligned with the block sizes handed in. */
  placements: MasonryPlacement[];
  /** How tall each column ended up, gap included — the state the greedy pass carries along. */
  columnBlockSizes: number[];
  /** How tall the container has to be to hold every column. */
  blockSize: number;
};
