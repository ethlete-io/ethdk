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

export type FitRectOptions = { rect: Rect; viewport: Size; padding: number };

export const fitRect = ({ rect, viewport, padding }: FitRectOptions): Camera => {
  const room = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  const zoom = clampZoom(Math.min(room.width / Math.max(1, rect.width), room.height / Math.max(1, rect.height)));

  return {
    x: viewport.width / 2 - (rect.x + rect.width / 2) * zoom,
    y: viewport.height / 2 - (rect.y + rect.height / 2) * zoom,
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
