import { describe, expect, it } from 'vitest';
import { flowColumnsOf, flowCurveOf, layoutFlow } from './flow-layout';

const spacing = { columnGap: 100, rowGap: 50 };

describe('flowColumnsOf', () => {
  it('puts each frame one column after the furthest frame that links to it', () => {
    const columns = flowColumnsOf(
      ['cart', 'done', 'checkout', 'help'],
      [
        { from: 'cart', to: 'checkout' },
        { from: 'checkout', to: 'done' },
        { from: 'cart', to: 'done' },
      ],
    );

    expect(Object.fromEntries(columns)).toEqual({ cart: 0, checkout: 1, done: 2, help: 0 });
  });

  it('ignores a link that closes a cycle and a link to the frame itself', () => {
    const columns = flowColumnsOf(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
        { from: 'b', to: 'b' },
      ],
    );

    expect(Object.fromEntries(columns)).toEqual({ a: 0, b: 1, c: 2 });
  });
});

describe('layoutFlow', () => {
  it('lays the frames out left to right along the links, stacking a column top to bottom', () => {
    const frames = layoutFlow(
      [
        { id: 'cart', width: 390, height: 844 },
        { id: 'checkout', width: 390, height: 844 },
        { id: 'error', width: 300, height: 200 },
        { id: 'done', width: 390, height: 844 },
      ],
      {
        links: [
          { from: 'cart', to: 'checkout' },
          { from: 'cart', to: 'error' },
          { from: 'checkout', to: 'done' },
        ],
        spacing,
      },
    );

    expect(frames).toEqual([
      { id: 'cart', x: 0, y: 0, width: 390, height: 844 },
      { id: 'checkout', x: 490, y: 0, width: 390, height: 844 },
      { id: 'error', x: 490, y: 894, width: 300, height: 200 },
      { id: 'done', x: 980, y: 0, width: 390, height: 844 },
    ]);
  });

  it('puts a frame with a position at it, outside the columns', () => {
    const frames = layoutFlow(
      [
        { id: 'a', width: 200, height: 100, at: { x: 5000, y: 40 } },
        { id: 'b', width: 300, height: 100 },
      ],
      { links: [{ from: 'a', to: 'b' }], spacing },
    );

    expect(frames).toEqual([
      { id: 'a', x: 5000, y: 40, width: 200, height: 100 },
      { id: 'b', x: 0, y: 0, width: 300, height: 100 },
    ]);
  });
});

describe('flowCurveOf', () => {
  it('runs from the right edge into the left edge of a frame to the right', () => {
    const curve = flowCurveOf({ x: 0, y: 0, width: 100, height: 200 }, { x: 300, y: 0, width: 100, height: 200 });

    expect(curve).toEqual({ path: 'M 100 100 C 200 100, 200 100, 300 100', middle: { x: 200, y: 100 } });
  });

  it('arcs over both tops back to a frame to the left', () => {
    const curve = flowCurveOf({ x: 300, y: 0, width: 100, height: 200 }, { x: 0, y: 0, width: 100, height: 200 });

    expect(curve.path).toBe('M 350 0 C 350 -133.5, 50 -133.5, 50 0');
    expect(curve.middle).toEqual({ x: 200, y: -100.125 });
  });
});
