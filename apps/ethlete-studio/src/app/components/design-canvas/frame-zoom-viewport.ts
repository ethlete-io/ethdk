import { CameraTarget, cameraAfterWheel, shortcutTarget } from './canvas-camera';
import { Camera, panCamera, Point } from './canvas-math';
import { ARROWS } from './canvas-viewport';
import { FrameZoomPreview } from './frame-zoom-camera';

export type FrameZoomViewportOptions = {
  viewport: HTMLElement;
  content: HTMLElement;
  frameSelector: string;
  camera: () => Camera;
  move: (camera: Camera) => void;
  preview: (shown: FrameZoomPreview | null, settle: () => void) => void;
  show: (target: CameraTarget, frame: HTMLElement | null) => void;
  select: (frame: HTMLElement) => void;
  activate: (frame: HTMLElement) => void;
  afterRender: (write: () => void) => void;
};

type WheelAnchor = { frame: HTMLElement; fx: number; fy: number; x: number; y: number };

type ZoomGesture = FrameZoomPreview & {
  origin: Point;
  base: number;
  last: WheelEvent;
  idle?: ReturnType<typeof setTimeout>;
};

const GESTURE_IDLE_MS = 150;
const MIN_PREVIEW_SCALE = 0.25;

const PRESSABLE =
  'button, a[href], input, select, textarea, summary, [contenteditable], [role="button"], [role="option"], [role="combobox"]';

const CLICK_SLOP = 3;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export const panRoomOf = (viewport: HTMLElement, content: HTMLElement): Point => ({
  x: Math.max(0, content.scrollWidth - viewport.clientWidth),
  y: Math.max(0, content.offsetHeight - viewport.clientHeight),
});

export const mountFrameZoomViewport = (options: FrameZoomViewportOptions) => {
  const { viewport } = options;
  const listeners = new AbortController();
  const signal = listeners.signal;
  let pressed: HTMLElement | null = null;
  let travel = 0;
  let anchor: WheelAnchor | null = null;
  let gesture: ZoomGesture | null = null;

  const frameOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(options.frameSelector) : null;

  const nearestFrame = (x: number, y: number) => {
    let nearest: HTMLElement | null = null;
    let best = Infinity;

    for (const frame of viewport.querySelectorAll<HTMLElement>(options.frameSelector)) {
      const box = frame.getBoundingClientRect();
      const distance = Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));

      if (box.width > 0 && distance < best) {
        best = distance;
        nearest = frame;
      }
    }

    return nearest;
  };

  const anchorAt = (event: WheelEvent): WheelAnchor | null => {
    const frame = frameOf(event.target) ?? nearestFrame(event.clientX, event.clientY);

    if (!frame) return null;

    const box = frame.getBoundingClientRect();

    return {
      frame,
      fx: (event.clientX - box.left) / box.width,
      fy: (event.clientY - box.top) / box.height,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const holdAnchor = () => {
    if (!anchor) return;

    const { frame, fx, fy, x, y } = anchor;
    const box = frame.getBoundingClientRect();
    const camera = options.camera();

    anchor = null;
    if (!frame.isConnected || box.width === 0) return;

    options.move({
      ...camera,
      x: camera.x + x - (box.left + fx * box.width),
      y: camera.y + y - (box.top + fy * box.height),
    });
  };

  const settle = () => {
    if (!gesture) return;

    const { last, zoom, x, y, idle } = gesture;

    clearTimeout(idle);
    anchor = anchorAt(last);
    gesture = null;

    const camera = options.camera();

    options.preview(null, settle);
    options.move(anchor ? { ...camera, zoom } : { x, y, zoom });
    if (anchor) options.afterRender(holdAnchor);
  };

  // WebKit re-rasterizes every scaled cell on a layout zoom (about 20 fps over 100 cells, finding 418), so a wheel
  // zoom shows as one transform of the laid-out content and lays out at the new zoom once the wheel rests.
  const previewZoom = (event: WheelEvent, zoom: number) => {
    if (!gesture) {
      const camera = options.camera();
      const content = options.content.getBoundingClientRect();

      gesture = {
        origin: { x: content.left - camera.x, y: content.top - camera.y },
        base: camera.zoom,
        x: camera.x,
        y: camera.y,
        scale: 1,
        zoom: camera.zoom,
        last: event,
      };
    }

    const scale = zoom / gesture.base;
    const cursor = { x: event.clientX - gesture.origin.x, y: event.clientY - gesture.origin.y };

    clearTimeout(gesture.idle);
    gesture = {
      ...gesture,
      x: cursor.x - ((cursor.x - gesture.x) * scale) / gesture.scale,
      y: cursor.y - ((cursor.y - gesture.y) * scale) / gesture.scale,
      scale,
      zoom,
      last: event,
      idle: setTimeout(settle, GESTURE_IDLE_MS),
    };
    options.preview({ x: gesture.x, y: gesture.y, scale, zoom }, settle);
    if (scale < MIN_PREVIEW_SCALE) settle();
  };

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      const zooming = event.ctrlKey || event.metaKey;

      if (!zooming) settle();

      const box = viewport.getBoundingClientRect();
      const camera = options.camera();
      const shown = gesture ? { ...camera, zoom: gesture.zoom } : camera;
      const next = cameraAfterWheel({
        camera: shown,
        wheel: event,
        point: { x: event.clientX - box.left, y: event.clientY - box.top },
      });

      if (next.zoom === shown.zoom) {
        if (!gesture) options.move(next);

        return;
      }

      if (!anchor) {
        previewZoom(event, next.zoom);

        return;
      }

      anchor = { ...anchor, x: event.clientX, y: event.clientY };
      options.move({ ...camera, zoom: next.zoom });
    },
    { passive: false, signal },
  );

  viewport.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 && event.button !== 1) return;
      settle();
      if (event.target instanceof Element && event.target.closest(PRESSABLE)) return;

      pressed = frameOf(event.target);
      travel = 0;
      viewport.focus({ preventScroll: true });
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal },
  );

  viewport.addEventListener(
    'pointermove',
    (event) => {
      if (!viewport.hasPointerCapture(event.pointerId)) return;

      travel += Math.abs(event.movementX) + Math.abs(event.movementY);
      options.move(panCamera(options.camera(), { x: event.movementX, y: event.movementY }));
    },
    { signal },
  );

  viewport.addEventListener(
    'pointerup',
    (event) => {
      if (!viewport.hasPointerCapture(event.pointerId)) return;

      viewport.releasePointerCapture(event.pointerId);
      if (pressed && travel < CLICK_SLOP) options.select(pressed);
    },
    { signal },
  );

  viewport.addEventListener(
    'dblclick',
    (event) => {
      const frame = frameOf(event.target) ?? pressed;

      settle();
      if (frame) options.activate(frame);
    },
    { signal },
  );

  viewport.addEventListener(
    'keydown',
    (event) => {
      const arrow = ARROWS[event.code];

      if (event.target !== viewport || (!arrow && event.code !== 'Space')) return;

      event.preventDefault();
      settle();
      if (arrow) options.move(panCamera(options.camera(), arrow));
    },
    { signal },
  );

  viewport.ownerDocument.defaultView?.addEventListener(
    'keydown',
    (event) => {
      const target = isEditable(event.target) ? null : shortcutTarget(event);

      if (!target) return;

      event.preventDefault();
      settle();
      options.show(target, pressed);
    },
    { signal },
  );

  return () => {
    if (gesture) clearTimeout(gesture.idle);
    gesture = null;
    listeners.abort();
  };
};
