export const MATRIX_COLUMN_GAP = 24;

const MATRIX_LINE_EXTRA = 40;

const MATRIX_GUTTER_ESTIMATE = 160;

/**
 * Splits the states of a matrix into consecutive blocks laid side by side, as few as it takes for no block to be
 * taller than the whole matrix is wide. Returns the block sizes in state order; fewer states than one block is one.
 */
export const matrixBlocksOf = (
  heights: readonly number[],
  { columns, frameWidth }: { columns: number; frameWidth: number },
) => {
  const count = heights.length;
  const blockWidth = MATRIX_GUTTER_ESTIMATE + columns * frameWidth + columns * MATRIX_COLUMN_GAP;
  const lines = heights.map((height) => height + MATRIX_LINE_EXTRA);

  for (let blocks = 1; blocks < count; blocks++) {
    const base = Math.floor(count / blocks);
    const sizes = Array.from({ length: blocks }, (_, index) => base + (index < count % blocks ? 1 : 0));
    let start = 0;
    const tallest = Math.max(
      ...sizes.map((size) => {
        const height = lines.slice(start, start + size).reduce((sum, line) => sum + line, 0);

        start += size;

        return height;
      }),
    );

    if (tallest <= blocks * blockWidth) return sizes;
  }

  return [count];
};
