import { CameraScene, CameraTarget, cameraAfterWheel, cameraFor, shortcutTarget, visibleFrame } from './canvas-camera';
import { Camera, panCamera, Rect } from './canvas-math';

export type CanvasViewportOptions = {
  /** The clipping element that takes wheel, drag, double-click and keys. */
  viewport: HTMLElement;
  /** The element the camera transforms, positioned at the viewport's top-left with `transform-origin: 0 0`. */
  world: HTMLElement;
  frameSelector: string;
  padding: number;
  /** World pixels kept around content and frames, so an outline drawn past their edge stays in view. */
  outline?: number;
  /** The chip's Fit and 100% controls and the element that shows the zoom. */
  chip?: { fit: Element | null; reset: Element | null; label: Element | null };
  /** The camera to start at instead of fitting all. */
  start?: Camera;
  /** Runs after every camera move with the frames measured in world space. */
  onPaint?: (camera: Camera, frames: Rect[]) => void;
};

export type CanvasViewport = {
  camera: () => Camera;
  show: (target: CameraTarget) => void;
  /** Moves the camera as the user would and stops it fitting all. */
  reset: (camera: Camera) => void;
};

export type { Camera, CameraTarget, Rect };

const ARROW_STEP = 80;

const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: ARROW_STEP, y: 0 },
  ArrowRight: { x: -ARROW_STEP, y: 0 },
  ArrowUp: { x: 0, y: ARROW_STEP },
  ArrowDown: { x: 0, y: -ARROW_STEP },
};

const padded = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

/**
 * Gives a drawing the design canvas's camera: fit all, a focused frame and the visible frame at 100%,
 * with wheel, drag, double-click and Shift+1/2/0. Frames are measured again whenever the viewport or
 * the world resizes, and the camera keeps fitting all until the user moves it.
 */
export const mountCanvasViewport = (options: CanvasViewportOptions): CanvasViewport => {
  const { viewport, world, padding, outline = 0, chip } = options;
  let camera: Camera = options.start ?? { x: 0, y: 0, zoom: 1 };
  let elements: HTMLElement[] = [];
  let frames: Rect[] = [];
  let focused: HTMLElement | null = null;
  let pressed: HTMLElement | null = null;
  let following = !options.start;

  const measure = () => {
    const origin = world.getBoundingClientRect();

    elements = [...world.querySelectorAll<HTMLElement>(options.frameSelector)];
    frames = elements.map((element) => {
      const box = element.getBoundingClientRect();

      return {
        x: (box.left - origin.left) / camera.zoom,
        y: (box.top - origin.top) / camera.zoom,
        width: box.width / camera.zoom,
        height: box.height / camera.zoom,
      };
    });
  };

  const scene = (): CameraScene => {
    const index = focused ? elements.indexOf(focused) : -1;
    const focusedFrame = frames[index];

    return {
      camera,
      viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
      frames: frames.map((frame) => padded(frame, outline)),
      focused: focusedFrame ? padded(focusedFrame, outline) : null,
      bounds: padded({ x: 0, y: 0, width: world.offsetWidth, height: world.offsetHeight }, outline),
      padding,
      align: 'start',
    };
  };

  const paint = () => {
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    if (chip?.label) chip.label.textContent = `${Math.round(camera.zoom * 100)}%`;
    options.onPaint?.(camera, frames);
  };

  const move = (next: Camera) => {
    following = false;
    camera = next;
    paint();
  };

  const show = (target: CameraTarget) => {
    const current = scene();

    if (target.kind === 'visible' && !focused) {
      const anchor = visibleFrame(current);

      focused = anchor ? (elements[current.frames.indexOf(anchor)] ?? null) : null;
    }

    if (target.kind === 'all') focused = null;

    const next = cameraFor(target, scene());

    if (!next) return;

    camera = next;
    following = target.kind === 'all';
    paint();
  };

  const settle = () => {
    measure();
    if (following) show({ kind: 'all' });
    else paint();
  };

  const pointOf = (event: MouseEvent) => {
    const box = viewport.getBoundingClientRect();

    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const frameOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(options.frameSelector) : null;

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      focused = null;
      move(cameraAfterWheel({ camera, wheel: event, point: pointOf(event) }));
    },
    { passive: false },
  );

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 1) return;

    pressed = frameOf(event.target);
    viewport.focus();
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!viewport.hasPointerCapture(event.pointerId)) return;

    focused = null;
    move(panCamera(camera, { x: event.movementX, y: event.movementY }));
  });

  viewport.addEventListener('pointerup', (event) => {
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  });

  viewport.addEventListener('dblclick', (event) => {
    const frame = frameOf(event.target) ?? pressed;

    if (!frame) return;

    focused = frame;
    show({ kind: 'focused' });
  });

  viewport.addEventListener('keydown', (event) => {
    const target = shortcutTarget(event);
    const arrow = ARROWS[event.code];

    if (target) show(target);
    else if (arrow) move(panCamera(camera, arrow));
    else return;

    event.preventDefault();
  });

  chip?.fit?.addEventListener('click', () => show({ kind: 'all' }));
  chip?.reset?.addEventListener('click', () => show({ kind: 'visible', zoom: 1 }));

  const resized = new ResizeObserver(settle);

  resized.observe(viewport);
  resized.observe(world);
  settle();
  void document.fonts.ready.then(settle);

  return { camera: () => camera, show, reset: move };
};
