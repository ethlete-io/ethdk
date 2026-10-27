import { describe, expect, it } from 'vitest';
import { flowColumnsOf, flowCurveOf, flowLabelRoomOf, layoutFlow } from './flow-layout';

const spacing = { columnGap: 100, rowGap: 50, maxColumnGap: 400 };

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

  it('widens a gap for a long line label up to the limit, and keeps the normal gap for a short one', () => {
    const wide = { columnGap: 200, rowGap: 50, maxColumnGap: 400 };
    const box = (id: string) => ({ id, width: 100, height: 100 });
    const leftsOf = (label: string) =>
      layoutFlow([box('a'), box('b'), box('c')], {
        links: [
          { from: 'a', to: 'b', label },
          { from: 'b', to: 'c', label: 'ok' },
        ],
        spacing: wide,
      }).map((frame) => frame.x);

    expect(leftsOf('next')).toEqual([0, 300, 600]);
    expect(leftsOf('x'.repeat(30))).toEqual([0, 100 + 30 * 7 + 18 + 80, 100 + 30 * 7 + 18 + 80 + 300]);
    expect(leftsOf('x'.repeat(200))).toEqual([0, 500, 800]);
  });

  it('gives a label the room of the gap between its frames, up to the limit', () => {
    const wide = { columnGap: 200, rowGap: 50, maxColumnGap: 400 };
    const frame = (x: number) => ({ x, y: 0, width: 100, height: 100 });

    expect(flowLabelRoomOf([frame(0), frame(400)], wide)).toBe(220);
    expect(flowLabelRoomOf([frame(0), frame(2000)], wide)).toBe(320);
    expect(flowLabelRoomOf([frame(400), frame(0)], wide)).toBe(320);
    expect(flowLabelRoomOf([frame(0), frame(120)], wide)).toBe(80);
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
