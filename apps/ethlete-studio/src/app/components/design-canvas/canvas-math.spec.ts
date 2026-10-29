import {
  MAX_ZOOM,
  MIN_ZOOM,
  boundingRect,
  clampZoom,
  fitRect,
  focusRect,
  layoutGrid,
  layoutMatrix,
  layoutMatrixSections,
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

  describe('focusRect', () => {
    const viewport = { width: 1000, height: 600 };
    const camera = { x: 0, y: 0, zoom: 0.5 };

    it('keeps the camera when the rect is already in view', () => {
      expect(
        focusRect({ rect: { x: 200, y: 200, width: 400, height: 300 }, camera, viewport, padding: 64 }),
      ).toBeNull();
    });

    it('pans to centre a rect outside the view without changing the zoom', () => {
      expect(focusRect({ rect: { x: 3000, y: 2000, width: 400, height: 200 }, camera, viewport, padding: 64 })).toEqual(
        { x: 500 - 3200 * 0.5, y: 300 - 2100 * 0.5, zoom: 0.5 },
      );
    });

    it('fits a rect larger than the view at the current zoom', () => {
      const rect = { x: 0, y: 0, width: 4000, height: 300 };

      expect(focusRect({ rect, camera, viewport, padding: 64 })).toEqual(fitRect({ rect, viewport, padding: 64 }));
    });
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

  it('labels a matrix row by its row label, and opens a larger gap where the row group changes', () => {
    const row = (name: string, rowGroup: string, rowLabel?: string) => ({
      id: name,
      width: 100,
      height: 40,
      row: name,
      column: 'x',
      rowGroup,
      ...(rowLabel ? { rowLabel } : {}),
    });
    const layout = layoutMatrix({
      frames: [row('solid · rest', 'solid'), row('solid · hover', 'solid', 'hover'), row('outline · rest', 'outline')],
      columns: ['x'],
      spacing: { columnGap: 40, rowGap: 60, groupGap: 150, emptyColumnWidth: 320 },
    });

    expect(layout.rows).toEqual([
      { name: 'solid · rest', y: 0 },
      { name: 'solid · hover', y: 100, label: 'hover' },
      { name: 'outline · rest', y: 290 },
    ]);
  });

  it('places a matrix by row and column, sizing a column by its widest frame and an empty one by default', () => {
    const layout = layoutMatrix({
      frames: [
        { id: 'now-a', width: 200, height: 50, row: 'a', column: 'now' },
        { id: 'x-a', width: 300, height: 90, row: 'a', column: 'x' },
        { id: 'x-b', width: 100, height: 40, row: 'b', column: 'x' },
      ],
      columns: ['now', 'drawing', 'x'],
      spacing: { columnGap: 40, rowGap: 60, emptyColumnWidth: 320 },
    });

    expect(layout.columns).toEqual([
      { name: 'now', x: 0, width: 200 },
      { name: 'drawing', x: 240, width: 320 },
      { name: 'x', x: 600, width: 300 },
    ]);
    expect(layout.rows).toEqual([
      { name: 'a', y: 0 },
      { name: 'b', y: 150 },
    ]);
    expect(layout.frames.map(({ id, x, y }) => [id, x, y])).toEqual([
      ['now-a', 0, 0],
      ['x-a', 600, 0],
      ['x-b', 600, 150],
    ]);
  });

  it('gives a row of short frames at least the minimum row height', () => {
    const layout = layoutMatrix({
      frames: [
        { id: 'a', width: 100, height: 10, row: 'a', column: 'x' },
        { id: 'b', width: 100, height: 10, row: 'b', column: 'x' },
        { id: 'c', width: 100, height: 90, row: 'c', column: 'x' },
        { id: 'd', width: 100, height: 10, row: 'd', column: 'x' },
      ],
      columns: ['x'],
      spacing: { columnGap: 40, rowGap: 48, emptyColumnWidth: 320, minRowHeight: 64 },
    });

    expect(layout.rows.map((row) => row.y)).toEqual([0, 112, 224, 362]);
  });

  it('starts a matrix row below what hangs under the frames of the row above', () => {
    const layout = layoutMatrix({
      frames: [
        { id: 'tall', width: 100, height: 200, row: 'a', column: 'x' },
        { id: 'short', width: 100, height: 50, row: 'a', column: 'y' },
        { id: 'next', width: 100, height: 50, row: 'b', column: 'x' },
      ],
      columns: ['x', 'y'],
      spacing: { columnGap: 40, rowGap: 60, emptyColumnWidth: 320 },
      below: { tall: 20, short: 300 },
    });

    expect(layout.rows).toEqual([
      { name: 'a', y: 0 },
      { name: 'b', y: 410 },
    ]);
  });

  it('gives a fitted matrix frame the width of its column, and keeps a frame at a width as it is', () => {
    const layout = layoutMatrix({
      frames: [
        { id: 'save', width: 80, height: 40, row: 'solid', column: 'x', fitted: true },
        { id: 'cancel', width: 120, height: 40, row: 'outline', column: 'x', fitted: true },
        { id: 'page', width: 90, height: 40, row: 'page', column: 'x' },
      ],
      columns: ['x'],
      spacing: { columnGap: 40, rowGap: 60, emptyColumnWidth: 320 },
    });

    expect(layout.frames.map(({ id, width }) => [id, width])).toEqual([
      ['save', 120],
      ['cancel', 120],
      ['page', 90],
    ]);
  });

  it('gives an empty matrix column its own width when it names one', () => {
    const layout = layoutMatrix({
      frames: [{ id: 'x-a', width: 300, height: 90, row: 'a', column: 'x' }],
      columns: ['narrow', 'x'],
      spacing: { columnGap: 40, rowGap: 60, emptyColumnWidth: 320 },
      emptyWidths: { narrow: 120, x: 10 },
    });

    expect(layout.columns).toEqual([
      { name: 'narrow', x: 0, width: 120 },
      { name: 'x', x: 160, width: 300 },
    ]);
  });

  it('stacks matrix sections top to bottom, each with its own columns, and gives a head-only section its own band', () => {
    const layout = layoutMatrixSections({
      frames: [
        { id: 'now-a', width: 200, height: 50, row: 'new a', column: 'now' },
        { id: 'c-a', width: 300, height: 90, row: 'new a', column: 'c' },
        { id: 'a-a', width: 100, height: 40, row: 'old a', column: 'a' },
      ],
      sections: [
        { columns: ['now', 'c'] },
        { columns: [], heads: [{ name: 'folded', height: 48 }] },
        { columns: ['a'] },
        { columns: [] },
      ],
      spacing: { columnGap: 40, rowGap: 60, emptyColumnWidth: 320 },
      sectionGap: 200,
    });

    expect(layout.columns).toEqual([
      { name: 'now', x: 0, width: 200, y: 0 },
      { name: 'c', x: 240, width: 300, y: 0 },
      { name: 'a', x: 0, width: 100, y: 538 },
    ]);
    expect(layout.rows).toEqual([
      { name: 'new a', y: 0 },
      { name: 'folded', y: 290, head: true },
      { name: 'old a', y: 538 },
    ]);
    expect(layout.frames.map(({ id, x, y }) => [id, x, y])).toEqual([
      ['now-a', 0, 0],
      ['c-a', 240, 0],
      ['a-a', 0, 538],
    ]);
  });
});
