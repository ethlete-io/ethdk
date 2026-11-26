import { STACK_BELOW_SCALE } from './interaction-grid';

export const MATRIX_COLUMN_GAP = 24;

export const MATRIX_MIN_COLUMN = 160;

export const MATRIX_HEAD_MIN = 120;

export const MATRIX_LABEL_MIN = 64;

const MATRIX_LINE_CHROME = 64;

const MATRIX_LINE_CHROME_BARE = 42;

const MATRIX_HEAD_HEIGHT = 170;

const MATRIX_GUTTER_ESTIMATE = 92;

const MATRIX_PADDING = 16;

/** The frame scale at which `blocks` blocks of `columns` frame-width columns fill `room` px of width. */
export const matrixWidthFit = ({
  room,
  columns,
  blocks,
  frameWidth,
}: {
  room: number;
  columns: number;
  blocks: number;
  frameWidth: number;
}) => room / (blocks * columns * frameWidth);

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
  gutter,
  viewport,
}: {
  heights: readonly number[];
  sizes: readonly number[];
  columns: number;
  frameWidth: number;
  gutter: number;
  viewport: MatrixViewport;
}) => {
  const blocks = sizes.length;
  const widthFit = matrixWidthFit({
    room: viewport.width - blocks * (gutter + columns * MATRIX_COLUMN_GAP) - MATRIX_PADDING,
    columns,
    blocks,
    frameWidth,
  });
  const heightFitWith = (chrome: number) => {
    let start = 0;
    let fit = Infinity;

    for (const size of sizes) {
      const frames = heights.slice(start, start + size).reduce((sum, height) => sum + height, 0);
      const room = viewport.height - MATRIX_HEAD_HEIGHT - size * chrome;

      fit = Math.min(fit, room / frames);
      start += size;
    }

    return fit;
  };
  const bare = heightFitWith(MATRIX_LINE_CHROME_BARE);
  const heightFit = Math.min(widthFit, bare) * frameWidth < MATRIX_LABEL_MIN ? bare : heightFitWith(MATRIX_LINE_CHROME);

  return { scale: Math.min(1, widthFit, heightFit), widthFit };
};

/**
 * Splits the states of a matrix into consecutive blocks laid side by side. Picks the block count with the largest frame
 * scale in the viewport, ties to fewer blocks, and never one whose frames would be narrower than the column floor.
 * Returns the block sizes in state order.
 */
export const matrixBlocksOf = (
  heights: readonly number[],
  {
    columns,
    frameWidth,
    gutter = MATRIX_GUTTER_ESTIMATE,
    viewport,
  }: { columns: number; frameWidth: number; gutter?: number; viewport: MatrixViewport },
) => {
  const count = heights.length;

  if (viewport.width <= 0 || viewport.height <= 0) return [count];

  let best = [count];
  let bestScale = -Infinity;

  for (let blocks = 1; blocks <= count; blocks++) {
    const sizes = sizesOf(count, blocks);
    const { scale, widthFit } = scaleOf({ heights, sizes, columns, frameWidth, gutter, viewport });

    if (blocks > 1 && widthFit * frameWidth < MATRIX_MIN_COLUMN) break;

    if (scale > bestScale + 1e-9) {
      best = sizes;
      bestScale = scale;
    }
  }

  return best;
};

/**
 * Whether wide frames leave the matrix and stack their variants instead: the matrix, one column per variant, would draw
 * below `STACK_BELOW_SCALE` in `room`, and a variant row, one column per state, would reach it.
 */
export const variantsLeaveMatrixOf = ({
  room,
  frameWidth,
  variants,
  states,
}: {
  room: number;
  frameWidth: number;
  variants: number;
  states: number;
}) => {
  if (variants < 2 || frameWidth <= 0) return false;

  const matrix =
    (room - MATRIX_GUTTER_ESTIMATE - variants * MATRIX_COLUMN_GAP - MATRIX_PADDING) / (variants * frameWidth);
  const stacked = (room - MATRIX_PADDING - (states - 1) * MATRIX_COLUMN_GAP) / (Math.max(1, states) * frameWidth);

  return matrix < STACK_BELOW_SCALE && stacked >= STACK_BELOW_SCALE;
};
