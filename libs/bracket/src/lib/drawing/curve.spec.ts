import { curvePath } from './curve';
import { BracketPosition } from './math';

const position = (inline: number, block: number): BracketPosition => ({
  inline: { start: inline, end: inline, center: inline },
  block: { start: block, end: block, center: block },
});

const curve = (from: BracketPosition, to: BracketPosition) =>
  curvePath(from, to, 'down', {
    lineStartingCurveAmount: 10,
    lineEndingCurveAmount: 10,
    path: { id: 'edge', width: 1, dashArray: 0, dashOffset: 0, className: '' },
  }).d;

const horizontalRuns = (d: string) => [...d.matchAll(/H (-?[\d.]+)/g)].map((match) => Number(match[1]));

describe('curvePath', () => {
  it('never runs backwards when the cards are closer inline than the two bends need', () => {
    const [straightEnd] = horizontalRuns(curve(position(0, 0), position(6, 100)));

    expect(straightEnd).toBeGreaterThanOrEqual(0);
  });

  it('keeps the same six commands for two cards on the same row', () => {
    expect(curve(position(0, 0), position(50, 0)).match(/[MHQV]/g)).toEqual(['M', 'H', 'Q', 'V', 'Q', 'H']);
  });

  it('turns at the given offset from the feeding card', () => {
    const d = curvePath(position(0, 0), position(60, 100), 'down', {
      lineStartingCurveAmount: 10,
      lineEndingCurveAmount: 0,
      turnOffset: 20,
      path: { id: 'edge', width: 1, dashArray: 0, dashOffset: 0, className: '' },
    }).d;

    expect(d).toContain('V ');
    expect(horizontalRuns(d)).toEqual([10, 60]);
    expect(d).toMatch(/Q 20 0, 20 10/);
  });

  it('turns mirrored offsets from the feeding card on its inline start', () => {
    const d = curvePath(position(60, 0), position(0, 100), 'down', {
      lineStartingCurveAmount: 10,
      lineEndingCurveAmount: 0,
      turnOffset: 20,
      inverted: true,
      path: { id: 'edge', width: 1, dashArray: 0, dashOffset: 0, className: '' },
    }).d;

    expect(horizontalRuns(d)[0]).toBe(50);
  });
});
