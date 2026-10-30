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
  /** Dims the frame of a variant the designer or an agent rejected. */
  rejected?: true;
  /** Draws a dashed empty cell with this text instead of a page, at the size of the row's other frames. */
  empty?: string;
  /** Where a `flow` canvas puts the frame's top-left corner instead of laying it out. */
  at?: { x: number; y: number };
  /** Draws a table of fitted cells inside the frame instead of `src`; each cell takes comments of its own. */
  grid?: FrameGrid;
  /** Draws only these areas of the page, each enlarged up to the frame's width, below a small picture of the whole page. */
  crop?: FrameCrop;
};

/** An area of a page, in the page's CSS pixels. */
export type CropArea = { x: number; y: number; width: number; height: number };

/** The areas of a page `frame` big that a cropped frame draws, top to bottom. */
export type FrameCrop = {
  areas: CropArea[];
  frame: { width: number; height: number };
};

const CROP_THUMB_SCALE = 0.2;
const CROP_THUMB_GAP = 24;
const CROP_MAX_SCALE = 2;

/** Where a cropped frame draws the picture of the whole page and each enlarged area, and its own size. */
export const croppedLayoutOf = (crop: FrameCrop) => {
  const { width, height } = crop.frame;
  const thumb = { width: width * CROP_THUMB_SCALE, height: height * CROP_THUMB_SCALE };
  let top = thumb.height + CROP_THUMB_GAP;
  const views = crop.areas.map((area) => {
    const scale = Math.min(width / area.width, CROP_MAX_SCALE);
    const view = { top, scale, width: area.width * scale, height: area.height * scale, area };

    top += view.height + CROP_THUMB_GAP;

    return view;
  });

  return {
    width,
    height: top - CROP_THUMB_GAP,
    thumb: {
      ...thumb,
      scale: CROP_THUMB_SCALE,
      outlines: crop.areas.map((area) => ({
        x: area.x * CROP_THUMB_SCALE,
        y: area.y * CROP_THUMB_SCALE,
        width: area.width * CROP_THUMB_SCALE,
        height: area.height * CROP_THUMB_SCALE,
      })),
    },
    views,
    page: crop.frame,
  };
};

const inArea = (area: CropArea, point: { x: number; y: number }) =>
  point.x >= area.x && point.y >= area.y && point.x <= area.x + area.width && point.y <= area.y + area.height;

/** Where a page point sits in a cropped frame: in the first enlarged area that shows it, else on the small whole page. */
export const cropPointOf = (crop: FrameCrop, point: { x: number; y: number }) => {
  const { thumb, views } = croppedLayoutOf(crop);
  const view = views.find((candidate) => inArea(candidate.area, point));

  return view
    ? { x: (point.x - view.area.x) * view.scale, y: view.top + (point.y - view.area.y) * view.scale }
    : { x: point.x * thumb.scale, y: point.y * thumb.scale };
};

/** The page point under a point of a cropped frame, in an enlarged area or on the small whole page above them. */
export const pagePointOfCrop = (crop: FrameCrop, point: { x: number; y: number }) => {
  const { thumb, views } = croppedLayoutOf(crop);
  const view = [...views].reverse().find((candidate) => candidate.top <= point.y);

  return view
    ? { x: view.area.x + point.x / view.scale, y: view.area.y + (point.y - view.top) / view.scale }
    : {
        x: Math.min(point.x / thumb.scale, crop.frame.width),
        y: Math.min(point.y / thumb.scale, crop.frame.height),
      };
};

/** Where a page rectangle sits in a cropped frame, cut to the first area that shows it, or `null` when none does. */
export const cropRectOf = (crop: FrameCrop, rect: { x: number; y: number; width: number; height: number }) => {
  for (const view of croppedLayoutOf(crop).views) {
    const { area } = view;
    const left = Math.max(rect.x, area.x);
    const top = Math.max(rect.y, area.y);
    const right = Math.min(rect.x + rect.width, area.x + area.width);
    const bottom = Math.min(rect.y + rect.height, area.y + area.height);

    if (right > left && bottom > top) {
      return {
        x: (left - area.x) * view.scale,
        y: view.top + (top - area.y) * view.scale,
        width: (right - left) * view.scale,
        height: (bottom - top) * view.scale,
      };
    }
  }

  return null;
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

/**
 * `sheet` draws the cells as one sheet: `table` every row in the interaction table, `groups` the rows that use only
 * the first column packed apart from it.
 */
export type FrameGrid = { columns: string[]; rows: string[]; cells: FrameCell[]; sheet?: 'table' | 'groups' };

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
