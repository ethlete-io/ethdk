import { clamp, ResizeEdge } from '@ethlete/core';
import { GridItemConstraints, GridItemPosition } from '../grid.types';

/** A rectangle in container-relative pixels (x/y measured from the container's padding box). */
export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GridGeometry = {
  /** Width available for columns (container client width minus horizontal padding). */
  contentWidth: number;
  columns: number;
  gap: number;
  rowHeight: number;
  cellWidth: number;
  /** Horizontal distance between the left edges of two adjacent columns. */
  strideX: number;
  /** Vertical distance between the top edges of two adjacent rows. */
  strideY: number;
  /** Container padding-left - the x of column 0. */
  originX: number;
  /** Container padding-top - the y of row 0. */
  originY: number;
};

/**
 * Effective span bounds for a resize gesture. Grid bounds and item constraints are
 * unified in span units per edge, so the clamped pixel rect and the snapped span
 * are always derived from the same limits and can never disagree.
 */
export type ResizeSpanBounds = {
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
};

export const computeGeometry = (options: {
  contentWidth: number;
  columns: number;
  gap: number;
  rowHeight: number;
  originX?: number;
  originY?: number;
}): GridGeometry => {
  const { contentWidth, columns, gap, rowHeight, originX = 0, originY = 0 } = options;
  const cellWidth = columns > 0 ? Math.max(0, (contentWidth - gap * (columns - 1)) / columns) : 0;

  return {
    contentWidth,
    columns,
    gap,
    rowHeight,
    cellWidth,
    strideX: cellWidth + gap,
    strideY: rowHeight + gap,
    originX,
    originY,
  };
};

export const spanWidth = (span: number, geometry: GridGeometry) =>
  span * geometry.cellWidth + (span - 1) * geometry.gap;

export const spanHeight = (span: number, geometry: GridGeometry) =>
  span * geometry.rowHeight + (span - 1) * geometry.gap;

export const positionToPixelRect = (position: GridItemPosition, geometry: GridGeometry): PixelRect => ({
  x: geometry.originX + position.col * geometry.strideX,
  y: geometry.originY + position.row * geometry.strideY,
  width: spanWidth(position.colSpan, geometry),
  height: spanHeight(position.rowSpan, geometry),
});

/** Pixel height of the given number of rows (content only, no container padding). */
export const rowsToPixelHeight = (rows: number, geometry: GridGeometry) =>
  rows <= 0 ? 0 : rows * geometry.rowHeight + (rows - 1) * geometry.gap;

export const pixelRectsEqual = (a: PixelRect | null, b: PixelRect | null) => {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
};

export const positionsEqual = (a: GridItemPosition | null, b: GridItemPosition | null) => {
  if (a === null || b === null) return a === b;
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
};

export const SNAP_HYSTERESIS = 0.1;

/**
 * Rounds a raw cell-unit value to the nearest integer with a hysteresis margin
 * relative to the last snapped value: the rounding boundary is shifted by
 * SNAP_HYSTERESIS against the direction of travel, so a pointer jittering exactly
 * on a cell midpoint cannot flap the snap back and forth (each flap would
 * re-trigger a full neighbour reflow).
 */
export const hysteresisRound = (raw: number, last: number | null) => {
  if (last === null) return Math.round(raw);
  if (raw > last) return Math.max(last, Math.round(raw - SNAP_HYSTERESIS));
  if (raw < last) return Math.min(last, Math.round(raw + SNAP_HYSTERESIS));
  return last;
};

const resizesEast = (edge: ResizeEdge) => edge === 'e' || edge === 'ne' || edge === 'se';
const resizesWest = (edge: ResizeEdge) => edge === 'w' || edge === 'nw' || edge === 'sw';
const resizesSouth = (edge: ResizeEdge) => edge === 's' || edge === 'se' || edge === 'sw';
const resizesNorth = (edge: ResizeEdge) => edge === 'n' || edge === 'ne' || edge === 'nw';

export const resizeSpanBounds = (options: {
  edge: ResizeEdge;
  start: GridItemPosition;
  constraints: GridItemConstraints;
  columns: number;
}): ResizeSpanBounds => {
  const { edge, start, constraints, columns } = options;

  let maxColSpan = constraints.maxColSpan;
  let maxRowSpan = constraints.maxRowSpan;

  if (resizesEast(edge)) maxColSpan = Math.min(maxColSpan, columns - start.col);
  if (resizesWest(edge)) maxColSpan = Math.min(maxColSpan, start.col + start.colSpan);
  if (resizesNorth(edge)) maxRowSpan = Math.min(maxRowSpan, start.row + start.rowSpan);

  maxColSpan = Math.max(1, maxColSpan);
  maxRowSpan = Math.max(1, maxRowSpan);

  return {
    minColSpan: clamp(constraints.minColSpan, 1, maxColSpan),
    maxColSpan,
    minRowSpan: clamp(constraints.minRowSpan, 1, maxRowSpan),
    maxRowSpan,
  };
};

export const clampResizeRect = (options: {
  edge: ResizeEdge;
  dx: number;
  dy: number;
  startRect: PixelRect;
  bounds: ResizeSpanBounds;
  geometry: GridGeometry;
}): PixelRect => {
  const { edge, dx, dy, startRect, bounds, geometry } = options;
  const rect = { ...startRect };

  if (resizesEast(edge)) {
    rect.width = clamp(
      startRect.width + dx,
      spanWidth(bounds.minColSpan, geometry),
      spanWidth(bounds.maxColSpan, geometry),
    );
  }
  if (resizesWest(edge)) {
    const rightEdge = startRect.x + startRect.width;
    rect.width = clamp(
      startRect.width - dx,
      spanWidth(bounds.minColSpan, geometry),
      spanWidth(bounds.maxColSpan, geometry),
    );
    rect.x = rightEdge - rect.width;
  }
  if (resizesSouth(edge)) {
    rect.height = clamp(
      startRect.height + dy,
      spanHeight(bounds.minRowSpan, geometry),
      spanHeight(bounds.maxRowSpan, geometry),
    );
  }
  if (resizesNorth(edge)) {
    const bottomEdge = startRect.y + startRect.height;
    rect.height = clamp(
      startRect.height - dy,
      spanHeight(bounds.minRowSpan, geometry),
      spanHeight(bounds.maxRowSpan, geometry),
    );
    rect.y = bottomEdge - rect.height;
  }

  return rect;
};

export const snapResizeSpan = (options: {
  edge: ResizeEdge;
  rect: PixelRect;
  start: GridItemPosition;
  bounds: ResizeSpanBounds;
  geometry: GridGeometry;
  lastSnap: GridItemPosition | null;
}): GridItemPosition => {
  const { edge, rect, start, bounds, geometry, lastSnap } = options;

  let { col, row, colSpan, rowSpan } = start;

  if (resizesEast(edge) || resizesWest(edge)) {
    const rawColSpan = (rect.width + geometry.gap) / geometry.strideX;
    colSpan = clamp(hysteresisRound(rawColSpan, lastSnap?.colSpan ?? null), bounds.minColSpan, bounds.maxColSpan);
    if (resizesWest(edge)) col = start.col + start.colSpan - colSpan;
  }
  if (resizesSouth(edge) || resizesNorth(edge)) {
    const rawRowSpan = (rect.height + geometry.gap) / geometry.strideY;
    rowSpan = clamp(hysteresisRound(rawRowSpan, lastSnap?.rowSpan ?? null), bounds.minRowSpan, bounds.maxRowSpan);
    if (resizesNorth(edge)) row = start.row + start.rowSpan - rowSpan;
  }

  return { col, row, colSpan, rowSpan };
};

export const projectDragCell = (options: {
  float: { x: number; y: number };
  colSpan: number;
  geometry: GridGeometry;
  lastTarget: { col: number; row: number } | null;
}): { col: number; row: number } => {
  const { float, colSpan, geometry, lastTarget } = options;

  const rawCol = (float.x - geometry.originX) / geometry.strideX;
  const rawRow = (float.y - geometry.originY) / geometry.strideY;

  const col = clamp(hysteresisRound(rawCol, lastTarget?.col ?? null), 0, Math.max(0, geometry.columns - colSpan));
  const row = Math.max(0, hysteresisRound(rawRow, lastTarget?.row ?? null));

  return { col, row };
};
