import { Observable, filter, map, pairwise, startWith } from 'rxjs';

/** The state of a part, at a preset, a width or fitted, that a frame draws; a comment on the frame names it. */
export const REST = 'rest';

export type FramePlace = {
  part: string;
  state: string;
  /** A preset name, a width in CSS pixels, or `fitted`. */
  size: string | number;
  /** The interaction forced on the frame; `rest` when missing. */
  interaction?: string;
  sketch?: { target: string; variant: string };
};

export type CanvasFrame = {
  id: string;
  src: string;
  /** Without one the frame takes the width its content reports. */
  width?: number;
  height?: number;
  label: string;
  row?: string;
  /** Shown beside the row instead of its name. */
  rowLabel?: string;
  /** Rows of one group sit closer to each other than to the rows of the next group. */
  rowGroup?: string;
  /** The `matrix` column the frame sits in. */
  column?: string;
  screenshot?: string;
  error?: string;
  place?: FramePlace;
  /** A muted line after the label. */
  note?: string;
  /** Dims the frame and shows this text over it, while what it draws is not final. */
  pending?: string;
  /** Draws a dashed empty cell with this text instead of a page, at the size of the row's other frames. */
  empty?: string;
  /** Where a `flow` canvas puts the frame's top-left corner instead of laying it out. */
  at?: { x: number; y: number };
  /** Draws a table of fitted cells inside the frame instead of `src`; each cell takes comments of its own. */
  grid?: FrameGrid;
};

/** One fitted page in a frame's grid, at a row and a column of it. */
export type FrameCell = {
  id: string;
  row: string;
  column: string;
  label: string;
  src: string;
  /** Without one the cell takes the width its content reports. */
  width?: number;
  screenshot?: string;
  place?: FramePlace;
};

export type FrameGrid = { columns: string[]; rows: string[]; cells: FrameCell[] };

/** The frames that take comments: each cell of a grid in place of its frame. */
export const placeableFramesOf = (frames: CanvasFrame[]): CanvasFrame[] =>
  frames.flatMap((frame) =>
    frame.grid
      ? frame.grid.cells.map(({ id, label, src, screenshot, place }) => ({
          id,
          label,
          src,
          ...(screenshot ? { screenshot } : {}),
          ...(place ? { place } : {}),
        }))
      : [frame],
  );

/** A `height` message names the frame page's `href`, and is `errored` when the page failed to draw or threw since it loaded. */
export type FrameMessage =
  | { type: 'loading' }
  | {
      type: 'height';
      height: number;
      width?: number;
      viewport?: { width: number; height: number };
      href?: string;
      errored?: true;
    }
  | { type: 'escape' };

const viewportOf = (data: object) => {
  if (!('viewport' in data) || typeof data.viewport !== 'object' || data.viewport === null) return null;

  const { viewport } = data;

  return 'width' in viewport &&
    typeof viewport.width === 'number' &&
    'height' in viewport &&
    typeof viewport.height === 'number'
    ? { width: viewport.width, height: viewport.height }
    : null;
};

/** Reads a message the frame page posts to its parent. A cross-origin frame reaches the canvas only this way. */
export const frameMessageOf = (data: unknown): FrameMessage | null => {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  if (data.type === 'design-explore:escape') return { type: 'escape' };
  if (data.type === 'design-explore:loading') return { type: 'loading' };
  if (data.type !== 'design-explore:height' || !('height' in data) || typeof data.height !== 'number') return null;

  const viewport = viewportOf(data);

  return {
    type: 'height',
    height: data.height,
    ...('width' in data && typeof data.width === 'number' ? { width: data.width } : {}),
    ...(viewport ? { viewport } : {}),
    ...('href' in data && typeof data.href === 'string' ? { href: data.href } : {}),
    ...('errored' in data && data.errored === true ? { errored: true as const } : {}),
  };
};

/** One side of a frame page measured, with the length of the page's own viewport on that side when known. */
export type MeasuredSide = { size: number; viewport?: number };

const feedsBack = (previous: MeasuredSide | null, next: MeasuredSide) =>
  previous !== null &&
  next.viewport !== undefined &&
  previous.viewport !== undefined &&
  next.viewport === previous.size &&
  next.size > next.viewport &&
  next.size - next.viewport === previous.size - previous.viewport;

/**
 * The sizes a frame takes from its page's measures. Content sized in `vh` or `vw` grows with the frame that
 * follows it, so a measure taken right after the frame took the last one, and over it by the same amount, is dropped.
 */
export const followedSizes = (measures$: Observable<MeasuredSide>) =>
  measures$.pipe(
    startWith(null),
    pairwise(),
    filter((pair): pair is [MeasuredSide | null, MeasuredSide] => pair[1] !== null),
    filter(([previous, next]) => !feedsBack(previous, next)),
    map(([, next]) => next.size),
  );
