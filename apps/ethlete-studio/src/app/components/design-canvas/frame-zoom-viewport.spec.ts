import { Camera } from './canvas-math';
import { FrameZoomPreview } from './frame-zoom-camera';
import { mountFrameZoomViewport } from './frame-zoom-viewport';

const boxed = (element: HTMLElement, box: () => DOMRect) => {
  element.getBoundingClientRect = box;

  return element;
};

const mount = () => {
  let camera: Camera = { x: 40, y: 20, zoom: 1 };
  let preview: FrameZoomPreview | null = null;
  const moves: Camera[] = [];
  const viewport = boxed(document.createElement('div'), () => new DOMRect(100, 50, 800, 600));
  const content = boxed(document.createElement('div'), () => new DOMRect(100 + camera.x, 50 + camera.y, 800, 600));
  const frame = boxed(document.createElement('div'), () => {
    const scale = camera.zoom * (preview ? preview.scale : 1);
    const x = preview ? preview.x : camera.x;
    const y = preview ? preview.y : camera.y;

    return new DOMRect(100 + x + 10 * scale, 50 + y + 10 * scale, 200 * scale, 100 * scale);
  });

  frame.dataset['frame'] = '';
  content.append(frame);
  viewport.append(content);
  document.body.append(viewport);

  const stop = mountFrameZoomViewport({
    viewport,
    content,
    frameSelector: '[data-frame]',
    camera: () => camera,
    move: (next) => {
      camera = next;
      moves.push(next);
    },
    preview: (shown) => (preview = shown),
    show: () => undefined,
    select: () => undefined,
    afterRender: (write) => write(),
  });
  const wheel = (clientX: number, clientY: number, deltaY = -100) =>
    frame.dispatchEvent(
      new WheelEvent('wheel', { clientX, clientY, deltaY, ctrlKey: true, bubbles: true, cancelable: true }),
    );

  return { stop, wheel, moves, frame, preview: () => preview, viewport };
};

describe('mountFrameZoomViewport', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows a ctrl-wheel zoom as a preview that keeps the point under the cursor, and moves once the wheel rests', () => {
    vi.useFakeTimers();
    const { wheel, moves, frame, preview, stop } = mount();
    const under = () => {
      const box = frame.getBoundingClientRect();

      return { fx: (200 - box.left) / box.width, fy: (120 - box.top) / box.height };
    };
    const before = under();

    wheel(200, 120);
    wheel(200, 120);

    expect(moves).toEqual([]);
    expect(preview()?.scale).toBeGreaterThan(1);
    expect(under().fx).toBeCloseTo(before.fx);
    expect(under().fy).toBeCloseTo(before.fy);

    const zoom = preview()?.zoom;

    vi.runAllTimers();

    expect(preview()).toBeNull();
    expect(moves.at(-1)?.zoom).toBe(zoom);
    expect(under().fx).toBeCloseTo(before.fx);
    expect(under().fy).toBeCloseTo(before.fy);
    stop();
  });

  it('settles a running preview before a pan', () => {
    vi.useFakeTimers();
    const { wheel, moves, preview, viewport, stop } = mount();

    wheel(200, 120);
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));

    expect(preview()).toBeNull();
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.at(-1)?.zoom).toBeGreaterThan(1);
    stop();
  });

  it('lays out again before a zoom-out preview shrinks the laid-out content below a quarter of its size', () => {
    vi.useFakeTimers();
    const { wheel, moves, preview, stop } = mount();

    while (moves.length === 0) {
      wheel(200, 120, 100);
      if (moves.length === 0) expect(preview()?.scale).toBeGreaterThanOrEqual(0.25);
    }

    expect(preview()).toBeNull();
    expect(moves.at(-1)?.zoom).toBeLessThan(0.25);
    stop();
  });
});
