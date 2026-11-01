import {
  boundingRect,
  Camera,
  clampZoom,
  fitRect,
  panCamera,
  Point,
  Rect,
  Size,
  wheelZoomFactor,
  zoomAtPoint,
} from './canvas-math';

/** Where a camera command looks: every frame, the focused frame, or the frame nearest the top of the view at `zoom`. */
export type CameraTarget = { kind: 'all' } | { kind: 'focused' } | { kind: 'visible'; zoom: number };

/**
 * What a camera command measures. `inset` is screen space kept free of frames, left and top. `covered` is the
 * screen width at the left that floating UI (the shell's side panel) hides: the canvas runs under it, but a
 * command treats the view as starting right of it.
 */
export type CameraScene = {
  camera: Camera;
  viewport: Size;
  frames: Rect[];
  focused: Rect | null;
  bounds?: Rect | null;
  padding: number;
  inset?: { left: number; top: number };
  covered?: number;
  align?: 'center' | 'start';
};

export type CanvasWheel = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

const LINE_HEIGHT = 16;

const insetOf = ({ inset, covered = 0 }: CameraScene) => ({
  left: covered + (inset?.left ?? 0),
  top: inset?.top ?? 0,
});

const fitInto = (scene: CameraScene, fit: { rect: Rect; maxZoom?: number }): Camera => {
  const { left, top } = insetOf(scene);
  const camera = fitRect({
    rect: fit.rect,
    viewport: { width: scene.viewport.width - left, height: scene.viewport.height - top },
    padding: scene.padding,
    maxZoom: fit.maxZoom,
    align: scene.align,
  });

  return { ...camera, x: camera.x + left, y: camera.y + top };
};

/** The frame a reset anchors: the focused one, else the one nearest the top centre of the view. */
export const visibleFrame = ({ camera, viewport, frames, focused, covered }: CameraScene): Rect | null => {
  if (focused) return focused;

  const centre = uncoveredCentre({ viewport, covered }).x;
  const distance = (frame: Rect) =>
    Math.abs(camera.x + (frame.x + frame.width / 2) * camera.zoom - centre) +
    Math.abs(camera.y + frame.y * camera.zoom);

  return frames.reduce<Rect | null>(
    (nearest, frame) => (nearest && distance(nearest) <= distance(frame) ? nearest : frame),
    null,
  );
};

/** The bounds of every frame in the row of the frame placed highest, or `null` without frames. */
export const firstRowBounds = (frames: (Rect & { row?: string })[]): Rect | null => {
  const top = frames.reduce<(Rect & { row?: string }) | null>(
    (highest, frame) => (highest && highest.y <= frame.y ? highest : frame),
    null,
  );

  return top ? boundingRect(frames.filter((frame) => frame.row === top.row)) : null;
};

/** The camera that shows `target`, or `null` when there is nothing to show. */
export const cameraFor = (target: CameraTarget, scene: CameraScene): Camera | null => {
  if (target.kind === 'all') {
    const bounds = scene.bounds === undefined ? boundingRect(scene.frames) : scene.bounds;

    return bounds ? fitInto(scene, { rect: bounds, maxZoom: 1 }) : null;
  }

  if (target.kind === 'focused') return scene.focused ? fitInto(scene, { rect: scene.focused }) : null;

  const frame = visibleFrame(scene);
  const { left, top } = insetOf(scene);

  const zoom = clampZoom(target.zoom);

  if (!frame) return zoomAtPoint({ camera: scene.camera, point: uncoveredCentre(scene), zoom });

  return { zoom, x: left + scene.padding - frame.x * zoom, y: top + scene.padding - frame.y * zoom };
};

/** The centre of the part of the viewport right of `covered`. */
export const uncoveredCentre = ({ viewport, covered = 0 }: Pick<CameraScene, 'viewport' | 'covered'>): Point => ({
  x: covered + (viewport.width - covered) / 2,
  y: viewport.height / 2,
});

export type UncoveredView = { camera: Camera; viewport: Size };

/** Runs a camera command as if the part of the viewport right of `covered` were the whole viewport. */
export const inUncoveredView = <T extends Camera | null>(
  { camera, viewport, covered }: UncoveredView & { covered: number },
  command: (view: UncoveredView) => T,
): T => {
  const next = command({
    camera: { ...camera, x: camera.x - covered },
    viewport: { width: Math.max(0, viewport.width - covered), height: viewport.height },
  });

  return (next && { ...next, x: next.x + covered }) as T;
};

/** Ctrl/Cmd+wheel zooms at `point`, Shift+wheel pans sideways, a plain wheel pans. */
export type CanvasWheelOptions = { camera: Camera; wheel: CanvasWheel; point: Point };

export const cameraAfterWheel = ({ camera, wheel, point }: CanvasWheelOptions): Camera => {
  const scale = wheel.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
  const deltaX = wheel.deltaX * scale;
  const deltaY = wheel.deltaY * scale;

  if (wheel.ctrlKey || wheel.metaKey)
    return zoomAtPoint({ camera, point, zoom: camera.zoom * wheelZoomFactor(deltaY) });
  if (wheel.shiftKey) return panCamera(camera, { x: -(deltaX || deltaY), y: 0 });

  return panCamera(camera, { x: -deltaX, y: -deltaY });
};

/** Shift+1 fits all, Shift+2 the focused frame, Shift+0 shows the visible frame at 100%. */
export const shortcutTarget = (
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): CameraTarget | null => {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.code === 'Digit1') return { kind: 'all' };
  if (event.code === 'Digit2') return { kind: 'focused' };
  if (event.code === 'Digit0') return { kind: 'visible', zoom: 1 };

  return null;
};
