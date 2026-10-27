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
  /** Draws a dashed empty cell with this text instead of a page, at the size of the row's other frames. */
  empty?: string;
  /** Where a `flow` canvas puts the frame's top-left corner instead of laying it out. */
  at?: { x: number; y: number };
};

/** A `height` message names the frame page's `href`, and is `errored` when the page failed to draw or threw since it loaded. */
export type FrameMessage =
  { type: 'height'; height: number; width?: number; href?: string; errored?: true } | { type: 'escape' };

/** Reads a message the frame page posts to its parent. A cross-origin frame reaches the canvas only this way. */
export const frameMessageOf = (data: unknown): FrameMessage | null => {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  if (data.type === 'design-explore:escape') return { type: 'escape' };
  if (data.type === 'design-explore:height' && 'height' in data && typeof data.height === 'number')
    return {
      type: 'height',
      height: data.height,
      ...('width' in data && typeof data.width === 'number' ? { width: data.width } : {}),
      ...('href' in data && typeof data.href === 'string' ? { href: data.href } : {}),
      ...('errored' in data && data.errored === true ? { errored: true as const } : {}),
    };

  return null;
};
