import {
  CameraScene,
  cameraAfterWheel,
  cameraFor,
  firstRowBounds,
  inUncoveredView,
  shortcutTarget,
  visibleFrame,
} from './canvas-camera';
import { focusRect, zoomAtPoint } from './canvas-math';

const left = { x: 0, y: 0, width: 300, height: 200 };
const right = { x: 400, y: 0, width: 300, height: 200 };

const scene = (overrides: Partial<CameraScene> = {}): CameraScene => ({
  camera: { x: 0, y: 0, zoom: 0.5 },
  viewport: { width: 400, height: 300 },
  frames: [left, right],
  focused: null,
  padding: 10,
  ...overrides,
});

describe('cameraFor', () => {
  it('fits every frame at most at 100%, inside the inset', () => {
    const camera = cameraFor({ kind: 'all' }, scene({ inset: { left: 20, top: 30 } }));

    expect(camera?.zoom).toBeCloseTo(360 / 700);
    expect(camera?.y).toBe(40);
  });

  it('fits the content bounds instead of the frames when given', () => {
    const camera = cameraFor(
      { kind: 'all' },
      scene({ bounds: { x: 0, y: 0, width: 100, height: 100 }, align: 'start' }),
    );

    expect(camera).toEqual({ x: 10, y: 10, zoom: 1 });
  });

  it('fits the focused frame, and nothing without one', () => {
    expect(cameraFor({ kind: 'focused' }, scene())).toBeNull();
    expect(cameraFor({ kind: 'focused' }, scene({ focused: right, align: 'start' }))).toEqual({
      x: 10 - 400 * (380 / 300),
      y: 10,
      zoom: 380 / 300,
    });
  });

  it('anchors the visible frame at its top-left', () => {
    const camera = cameraFor({ kind: 'visible', zoom: 1 }, scene({ camera: { x: -150, y: 0, zoom: 0.5 } }));

    expect(camera).toEqual({ x: 10 - 400, y: 10, zoom: 1 });
  });
});

describe('a viewport partly covered by the shell panel', () => {
  it('fits every frame into the part right of the panel', () => {
    expect(cameraFor({ kind: 'all' }, scene({ covered: 100 }))).toEqual({ x: 110, y: 10, zoom: 0.4 });
  });

  it('anchors the frame nearest the centre of the uncovered part, right of the panel', () => {
    const camera = cameraFor(
      { kind: 'visible', zoom: 1 },
      scene({ camera: { x: 100, y: 0, zoom: 0.5 }, covered: 200 }),
    );

    expect(camera).toEqual({ x: -190, y: 10, zoom: 1 });
  });

  it('zooms at the centre of the uncovered part without frames', () => {
    const camera = { x: 0, y: 0, zoom: 0.5 };

    expect(cameraFor({ kind: 'visible', zoom: 1 }, scene({ camera, frames: [], covered: 200 }))).toEqual(
      zoomAtPoint({ camera, point: { x: 300, y: 150 }, zoom: 1 }),
    );
  });

  it('centres a focused frame in the uncovered part', () => {
    const rect = { x: 1000, y: 0, width: 20, height: 20 };
    const camera = inUncoveredView(
      { camera: { x: 0, y: 0, zoom: 0.5 }, viewport: { width: 400, height: 300 }, covered: 200 },
      (view) => focusRect({ rect, ...view, padding: 10 }),
    );

    expect(camera && camera.x + (rect.x + rect.width / 2) * camera.zoom).toBe(300);
  });
});

describe('visibleFrame', () => {
  it('prefers the focused frame', () => {
    expect(visibleFrame(scene({ focused: left, camera: { x: -150, y: 0, zoom: 0.5 } }))).toBe(left);
  });

  it('picks the frame nearest the top centre of the view', () => {
    expect(visibleFrame(scene({ camera: { x: 100, y: 0, zoom: 0.5 } }))).toBe(left);
    expect(visibleFrame(scene({ camera: { x: -150, y: 0, zoom: 0.5 } }))).toBe(right);
  });
});

describe('cameraAfterWheel', () => {
  const wheel = { deltaX: 0, deltaY: 10, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false };

  it('pans, pans sideways with Shift, and zooms at the pointer with Ctrl', () => {
    const camera = { x: 0, y: 0, zoom: 1 };

    expect(cameraAfterWheel({ camera, wheel, point: { x: 0, y: 0 } })).toEqual({ x: 0, y: -10, zoom: 1 });
    expect(cameraAfterWheel({ camera, wheel: { ...wheel, shiftKey: true }, point: { x: 0, y: 0 } })).toEqual({
      x: -10,
      y: 0,
      zoom: 1,
    });
    expect(cameraAfterWheel({ camera, wheel: { ...wheel, ctrlKey: true }, point: { x: 50, y: 50 } }).zoom).toBeLessThan(
      1,
    );
  });
});

describe('shortcutTarget', () => {
  const key = (code: string, shiftKey = true) => ({ code, shiftKey, ctrlKey: false, metaKey: false, altKey: false });

  it('maps Shift+1, Shift+2 and Shift+0 to their targets', () => {
    expect(shortcutTarget(key('Digit1'))).toEqual({ kind: 'all' });
    expect(shortcutTarget(key('Digit2'))).toEqual({ kind: 'focused' });
    expect(shortcutTarget(key('Digit0'))).toEqual({ kind: 'visible', zoom: 1 });
    expect(shortcutTarget(key('Digit0', false))).toBeNull();
  });
});

describe('firstRowBounds', () => {
  const rows = ['pages/start', 'pages/library', 'pages/settings', 'components/card', 'components/list'].flatMap(
    (row, index) => [
      { row, x: 0, y: index * 1000, width: 1440, height: 900 },
      { row, x: 1540, y: index * 1000, width: 1440, height: 900 },
    ],
  );

  it('bounds the frames of the row placed highest, whatever order they come in', () => {
    expect(firstRowBounds([...rows].reverse())).toEqual({ x: 0, y: 0, width: 2980, height: 900 });
    expect(firstRowBounds([])).toBeNull();
  });

  it('fits a merge preview of five pages to its first row at a zoom that keeps text readable', () => {
    const camera = cameraFor(
      { kind: 'all' },
      scene({ viewport: { width: 1200, height: 800 }, frames: rows, bounds: firstRowBounds(rows), padding: 24 }),
    );

    expect(camera?.zoom).toBeCloseTo(1152 / 2980);
  });
});
