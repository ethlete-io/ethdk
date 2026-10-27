import {
  MAX_ZOOM,
  MIN_ZOOM,
  boundingRect,
  clampZoom,
  fitRect,
  layoutGrid,
  layoutSheet,
  rectsIntersect,
  screenToWorld,
  visibleWorldRect,
  wheelZoomFactor,
  zoomAtPoint,
} from './canvas-math';

describe('canvas math', () => {
  it('clamps the zoom to its range', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('keeps the world point under the pointer fixed while zooming', () => {
    const camera = { x: 40, y: -120, zoom: 0.5 };
    const pointer = { x: 300, y: 200 };
    const before = screenToWorld(camera, pointer);

    const zoomed = zoomAtPoint({ camera, point: pointer, zoom: 2 });

    expect(zoomed.zoom).toBe(2);
    expect(screenToWorld(zoomed, pointer).x).toBeCloseTo(before.x);
    expect(screenToWorld(zoomed, pointer).y).toBeCloseTo(before.y);
  });

  it('keeps the pointer fixed when the zoom hits its limit', () => {
    const camera = { x: 0, y: 0, zoom: 7 };
    const pointer = { x: 50, y: 80 };
    const zoomed = zoomAtPoint({ camera, point: pointer, zoom: 20 });

    expect(zoomed.zoom).toBe(MAX_ZOOM);
    expect(screenToWorld(zoomed, pointer).x).toBeCloseTo(screenToWorld(camera, pointer).x);
  });

  it('turns a wheel delta into a bounded zoom factor', () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1);
    expect(wheelZoomFactor(10)).toBeLessThan(1);
    expect(wheelZoomFactor(1000)).toBe(wheelZoomFactor(25));
  });

  it('fits a rect centered across and at the top of the viewport', () => {
    const camera = fitRect({
      rect: { x: 100, y: 50, width: 2000, height: 500 },
      viewport: { width: 1000, height: 800 },
      padding: 50,
    });

    expect(camera.zoom).toBeCloseTo(0.45);
    expect(camera.x + (100 + 1000) * camera.zoom).toBeCloseTo(500);
    expect(camera.y + 50 * camera.zoom).toBeCloseTo(50);
  });

  it('stops at maxZoom', () => {
    expect(
      fitRect({
        rect: { x: 0, y: 0, width: 100, height: 50 },
        viewport: { width: 1000, height: 600 },
        padding: 0,
        maxZoom: 1,
      }).zoom,
    ).toBe(1);
  });

  it('centers a rect that fills the height', () => {
    const camera = fitRect({
      rect: { x: 0, y: 0, width: 100, height: 1000 },
      viewport: { width: 1000, height: 600 },
      padding: 0,
    });

    expect(camera.y).toBeCloseTo(0);
    expect(camera.x + 50 * camera.zoom).toBeCloseTo(500);
  });

  it('fits by the tighter axis', () => {
    expect(
      fitRect({ rect: { x: 0, y: 0, width: 100, height: 1000 }, viewport: { width: 1000, height: 600 }, padding: 0 })
        .zoom,
    ).toBeCloseTo(0.6);
  });

  it('computes the visible world rect with a screen margin', () => {
    const rect = visibleWorldRect({
      camera: { x: -100, y: 0, zoom: 2 },
      viewport: { width: 800, height: 600 },
      margin: 100,
    });

    expect(rect).toEqual({ x: 0, y: -50, width: 500, height: 400 });
  });

  it('detects overlapping rects but not touching ones', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };

    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('bounds a set of rects', () => {
    expect(boundingRect([])).toBeNull();
    expect(
      boundingRect([
        { x: 0, y: 10, width: 10, height: 10 },
        { x: -5, y: 30, width: 10, height: 5 },
      ]),
    ).toEqual({ x: -5, y: 10, width: 15, height: 25 });
  });

  it('lays out one row per state, frames side by side', () => {
    const layout = layoutSheet(
      [
        { id: 'a-375', width: 375, height: 300, row: 'default' },
        { id: 'b-375', width: 375, height: 100, row: 'hover' },
        { id: 'a-1280', width: 1280, height: 200, row: 'default' },
      ],
      { columnGap: 40, rowGap: 80 },
    );

    expect(layout.rows).toEqual([
      { name: 'default', y: 0 },
      { name: 'hover', y: 380 },
    ]);
    expect(layout.frames.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'a-375', x: 0, y: 0 },
      { id: 'a-1280', x: 415, y: 0 },
      { id: 'b-375', x: 0, y: 380 },
    ]);
  });

  it('lays tiles out in lines that wrap before the line width', () => {
    const layout = layoutGrid(
      [
        { id: 'a', width: 200, height: 50, row: '' },
        { id: 'b', width: 300, height: 120, row: '' },
        { id: 'c', width: 400, height: 80, row: '' },
        { id: 'd', width: 900, height: 60, row: '' },
      ],
      { columnGap: 40, rowGap: 60, lineWidth: 800 },
    );

    expect(layout.rows).toEqual([]);
    expect(layout.frames.map(({ id, x, y }) => [id, x, y])).toEqual([
      ['a', 0, 0],
      ['b', 240, 0],
      ['c', 0, 180],
      ['d', 0, 320],
    ]);
  });
});
