export type Point = { x: number; y: number };

export type Size = { width: number; height: number };

export type Rect = { x: number; y: number; width: number; height: number };

/** Screen position of a world point: `world * zoom + (x, y)`. */
export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const screenToWorld = (camera: Camera, point: Point): Point => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

export const panCamera = (camera: Camera, delta: Point): Camera => ({
  ...camera,
  x: camera.x + delta.x,
  y: camera.y + delta.y,
});

export type ZoomAtPointOptions = { camera: Camera; point: Point; zoom: number };

export const zoomAtPoint = ({ camera, point, zoom }: ZoomAtPointOptions): Camera => {
  const next = clampZoom(zoom);
  const anchor = screenToWorld(camera, point);

  return { x: point.x - anchor.x * next, y: point.y - anchor.y * next, zoom: next };
};

export const wheelZoomFactor = (deltaY: number) => Math.exp(-Math.max(-25, Math.min(25, deltaY)) * 0.01);

export type FitRectOptions = { rect: Rect; viewport: Size; padding: number; maxZoom?: number };

export const fitRect = ({ rect, viewport, padding, maxZoom = Infinity }: FitRectOptions): Camera => {
  const room = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  const zoom = clampZoom(
    Math.min(room.width / Math.max(1, rect.width), room.height / Math.max(1, rect.height), maxZoom),
  );

  return {
    x: viewport.width / 2 - (rect.x + rect.width / 2) * zoom,
    y: Math.min(viewport.height / 2 - (rect.y + rect.height / 2) * zoom, padding - rect.y * zoom),
    zoom,
  };
};

export type VisibleWorldRectOptions = { camera: Camera; viewport: Size; margin: number };

export const visibleWorldRect = ({ camera, viewport, margin }: VisibleWorldRectOptions): Rect => {
  const topLeft = screenToWorld(camera, { x: -margin, y: -margin });

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: (viewport.width + margin * 2) / camera.zoom,
    height: (viewport.height + margin * 2) / camera.zoom,
  };
};

export type FocusRectOptions = { rect: Rect; camera: Camera; viewport: Size; padding: number };

/** The camera that brings a rect into view at the current zoom, or `null` when it is already in view. */
export const focusRect = ({ rect, camera, viewport, padding }: FocusRectOptions): Camera | null => {
  const view = visibleWorldRect({ camera, viewport, margin: -padding });

  if (rect.width > view.width || rect.height > view.height) return fitRect({ rect, viewport, padding });

  const inView =
    rect.x >= view.x &&
    rect.y >= view.y &&
    rect.x + rect.width <= view.x + view.width &&
    rect.y + rect.height <= view.y + view.height;

  if (inView) return null;

  return {
    x: viewport.width / 2 - (rect.x + rect.width / 2) * camera.zoom,
    y: viewport.height / 2 - (rect.y + rect.height / 2) * camera.zoom,
    zoom: camera.zoom,
  };
};

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const boundingRect = (rects: Rect[]): Rect | null => {
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
};

export type SheetFrame = { id: string; width: number; height: number; row: string };

export type SheetRow = { name: string; y: number };

export type SheetLayout = { frames: (SheetFrame & Rect)[]; rows: SheetRow[] };

export type SheetSpacing = { columnGap: number; rowGap: number };

export const layoutSheet = (frames: SheetFrame[], spacing: SheetSpacing): SheetLayout => {
  const order: string[] = [];
  const byRow = new Map<string, SheetFrame[]>();

  for (const frame of frames) {
    const row = byRow.get(frame.row);

    if (row) {
      row.push(frame);
    } else {
      order.push(frame.row);
      byRow.set(frame.row, [frame]);
    }
  }

  const placed: SheetLayout['frames'] = [];
  const rows: SheetRow[] = [];
  let y = 0;

  for (const name of order) {
    const members = byRow.get(name) ?? [];
    let x = 0;

    rows.push({ name, y });

    for (const frame of members) {
      placed.push({ ...frame, x, y });
      x += frame.width + spacing.columnGap;
    }

    y += Math.max(...members.map((m) => m.height)) + spacing.rowGap;
  }

  return { frames: placed, rows };
};

export type GridSpacing = SheetSpacing & { lineWidth: number };

/** Places frames left to right and starts a new line once a frame would pass `lineWidth`. */
export const layoutGrid = (frames: SheetFrame[], spacing: GridSpacing): SheetLayout => {
  const placed: SheetLayout['frames'] = [];
  let x = 0;
  let y = 0;
  let lineHeight = 0;

  for (const frame of frames) {
    if (x > 0 && x + frame.width > spacing.lineWidth) {
      x = 0;
      y += lineHeight + spacing.rowGap;
      lineHeight = 0;
    }

    placed.push({ ...frame, x, y });
    x += frame.width + spacing.columnGap;
    lineHeight = Math.max(lineHeight, frame.height);
  }

  return { frames: placed, rows: [] };
};

export type MatrixFrame = SheetFrame & { column: string };

export type MatrixColumnPlace = { name: string; x: number; width: number };

export type MatrixLayout = SheetLayout & { columns: MatrixColumnPlace[] };

export type MatrixSpacing = SheetSpacing & { emptyColumnWidth: number };

/**
 * Places each frame at its row and its column: a column is as wide as its widest frame (an empty one
 * `emptyColumnWidth`), a row as tall as its tallest. Columns keep the order of `columns`, rows the order
 * they first appear in.
 */
export const layoutMatrix = ({
  frames,
  columns,
  spacing,
}: {
  frames: MatrixFrame[];
  columns: string[];
  spacing: MatrixSpacing;
}): MatrixLayout => {
  const rowNames = [...new Set(frames.map((frame) => frame.row))];
  const placedColumns: MatrixColumnPlace[] = [];
  let x = 0;

  for (const name of columns) {
    const members = frames.filter((frame) => frame.column === name);
    const width = members.length > 0 ? Math.max(...members.map((m) => m.width)) : spacing.emptyColumnWidth;

    placedColumns.push({ name, x, width });
    x += width + spacing.columnGap;
  }

  const rows: SheetRow[] = [];
  const placed: SheetLayout['frames'] = [];
  let y = 0;

  for (const name of rowNames) {
    const members = frames.filter((frame) => frame.row === name);

    rows.push({ name, y });

    for (const frame of members) {
      const column = placedColumns.find((candidate) => candidate.name === frame.column);

      if (column)
        placed.push({ id: frame.id, row: frame.row, width: frame.width, height: frame.height, x: column.x, y });
    }

    y += Math.max(...members.map((m) => m.height)) + spacing.rowGap;
  }

  return { frames: placed, rows, columns: placedColumns };
};
