export const MATRIX_COLUMN_GAP = 24;

export const MATRIX_MIN_COLUMN = 160;

const MATRIX_LINE_CHROME = 40;

const MATRIX_HEAD_HEIGHT = 120;

const MATRIX_GUTTER_ESTIMATE = 110;

const MATRIX_PADDING = 16;

type MatrixViewport = { width: number; height: number };

const sizesOf = (count: number, blocks: number) => {
  const base = Math.floor(count / blocks);

  return Array.from({ length: blocks }, (_, index) => base + (index < count % blocks ? 1 : 0));
};

/**
 * The frame scale a matrix of consecutive blocks reaches in the viewport: the smaller of the width fit and the height fit,
 * where the gutter, the heads and the per-row chrome stay unscaled.
 */
const scaleOf = ({
  heights,
  sizes,
  columns,
  frameWidth,
  viewport,
}: {
  heights: readonly number[];
  sizes: readonly number[];
  columns: number;
  frameWidth: number;
  viewport: MatrixViewport;
}) => {
  const blocks = sizes.length;
  const widthFit =
    (viewport.width - blocks * (MATRIX_GUTTER_ESTIMATE + columns * MATRIX_COLUMN_GAP) - MATRIX_PADDING) /
    (blocks * columns * frameWidth);
  let start = 0;
  let heightFit = Infinity;

  for (const size of sizes) {
    const frames = heights.slice(start, start + size).reduce((sum, height) => sum + height, 0);
    const room = Math.max(viewport.height - MATRIX_HEAD_HEIGHT - size * MATRIX_LINE_CHROME, viewport.height / 2);

    heightFit = Math.min(heightFit, room / frames);
    start += size;
  }

  return { scale: Math.min(1, widthFit, heightFit), widthFit };
};

/**
 * Splits the states of a matrix into consecutive blocks laid side by side. Picks the block count with the largest frame
 * scale in the viewport, ties to fewer blocks, and never one whose columns would be narrower than a variant head.
 * Returns the block sizes in state order.
 */
export const matrixBlocksOf = (
  heights: readonly number[],
  { columns, frameWidth, viewport }: { columns: number; frameWidth: number; viewport: MatrixViewport },
) => {
  const count = heights.length;
  let best = [count];
  let bestScale = -Infinity;

  for (let blocks = 1; blocks <= count; blocks++) {
    const sizes = sizesOf(count, blocks);
    const { scale, widthFit } = scaleOf({ heights, sizes, columns, frameWidth, viewport });

    if (blocks > 1 && widthFit * frameWidth < MATRIX_MIN_COLUMN) break;

    if (scale > bestScale + 1e-9) {
      best = sizes;
      bestScale = scale;
    }
  }

  return best;
};
