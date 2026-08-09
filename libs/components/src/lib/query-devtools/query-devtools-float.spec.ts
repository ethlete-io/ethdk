import { ResizeMoveEvent } from '@ethlete/core';
import { resizedFloatRect } from './query-devtools.component';

const VIEWPORT = { width: 1400, height: 900 };
const BASE = { x: 200, y: 100, width: 600, height: 400 };

const MV = (edge: ResizeMoveEvent['edge'], dx: number, dy: number) => ({
  move: { edge, dx, dy, clientX: 0, clientY: 0 },
  viewport: VIEWPORT,
});

describe('resizedFloatRect', () => {
  it('should grow to the east without moving the origin', () => {
    expect(resizedFloatRect(BASE, MV('e', 120, 0))).toEqual({ ...BASE, width: 720 });
  });

  it('should grow to the west by moving the origin with it', () => {
    expect(resizedFloatRect(BASE, MV('w', -120, 0))).toEqual({ ...BASE, x: 80, width: 720 });
  });

  it('should grow to the north by moving the origin with it', () => {
    expect(resizedFloatRect(BASE, MV('n', 0, -60))).toEqual({ ...BASE, y: 40, height: 460 });
  });

  it('should resize both axes from a corner', () => {
    expect(resizedFloatRect(BASE, MV('se', 100, 80))).toEqual({ ...BASE, width: 700, height: 480 });
  });

  it('should stop the origin where the minimum size stops the drag', () => {
    const resized = resizedFloatRect(BASE, MV('w', 5000, 0));

    expect(resized.width).toBe(360);
    expect(resized.x + resized.width).toBe(BASE.x + BASE.width);
  });

  it('should not let an east drag push the panel past the viewport', () => {
    const resized = resizedFloatRect(BASE, MV('e', 5000, 0));

    expect(resized.x).toBe(BASE.x);
    expect(resized.x + resized.width).toBe(VIEWPORT.width);
  });

  it('should not let a west drag push the origin off screen', () => {
    const resized = resizedFloatRect(BASE, MV('w', -5000, 0));

    expect(resized.x).toBe(0);
    expect(resized.width).toBe(BASE.x + BASE.width);
  });

  it('should leave the untouched axis alone', () => {
    expect(resizedFloatRect(BASE, MV('e', 40, 400)).height).toBe(BASE.height);
    expect(resizedFloatRect(BASE, MV('s', 400, 40)).width).toBe(BASE.width);
  });

  it('should fit a rect into a viewport smaller than the panel', () => {
    const resized = resizedFloatRect(BASE, { ...MV('se', 0, 0), viewport: { width: 500, height: 300 } });

    expect(resized.x).toBeGreaterThanOrEqual(0);
    expect(resized.y).toBeGreaterThanOrEqual(0);
    expect(resized.x + resized.width).toBeLessThanOrEqual(500);
    expect(resized.y + resized.height).toBeLessThanOrEqual(300);
  });
});
