import { ResizeMoveEvent } from '@ethlete/core';
import { clampFloatToPeek, resizedFloatRect, settledFloatRect } from './query-devtools.component';

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

describe('clampFloatToPeek', () => {
  it('should allow a panel to be shoved off the left with only its peek showing', () => {
    expect(clampFloatToPeek({ ...BASE, x: -5000 }, VIEWPORT).x).toBe(44 - BASE.width);
  });

  it('should allow a panel to be shoved off the right with only its peek showing', () => {
    expect(clampFloatToPeek({ ...BASE, x: 5000 }, VIEWPORT).x).toBe(VIEWPORT.width - 44);
  });

  it('should never let the title bar leave through the top', () => {
    expect(clampFloatToPeek({ ...BASE, y: -5000 }, VIEWPORT).y).toBe(0);
  });

  it('should allow a panel to be shoved off the bottom', () => {
    expect(clampFloatToPeek({ ...BASE, y: 5000 }, VIEWPORT).y).toBe(VIEWPORT.height - 44);
  });
});

describe('settledFloatRect', () => {
  it('should pull a panel back in when the drag stopped short of halfway', () => {
    const settled = settledFloatRect({ ...BASE, x: -100 }, VIEWPORT);

    expect(settled.collapsed).toBe(false);
    expect(settled.rect.x).toBe(0);
  });

  it('should park a panel dragged more than halfway off the left', () => {
    const settled = settledFloatRect({ ...BASE, x: -400 }, VIEWPORT);

    expect(settled.collapsed).toBe(true);
    expect(settled.rect.x).toBe(44 - BASE.width);
  });

  it('should park a panel dragged more than halfway off the right', () => {
    const settled = settledFloatRect({ ...BASE, x: VIEWPORT.width - 200 }, VIEWPORT);

    expect(settled.collapsed).toBe(true);
    expect(settled.rect.x).toBe(VIEWPORT.width - 44);
  });

  it('should park a panel dragged more than halfway off the bottom', () => {
    const settled = settledFloatRect({ ...BASE, y: VIEWPORT.height - 100 }, VIEWPORT);

    expect(settled.collapsed).toBe(true);
    expect(settled.rect.y).toBe(VIEWPORT.height - 44);
  });

  it('should keep the other axis inside when only one parks', () => {
    const settled = settledFloatRect({ ...BASE, x: -400, y: 700 }, VIEWPORT);

    expect(settled.rect.x).toBe(44 - BASE.width);
    expect(settled.rect.y).toBe(VIEWPORT.height - BASE.height);
  });
});
