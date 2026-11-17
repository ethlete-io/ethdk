import { diffMarkOf } from './diff-mark';

const outset = (share: string) => `max(var(--et-diff-mark-stroke), calc(${share} - var(--et-diff-mark-stroke)))`;

describe('diffMarkOf', () => {
  it('marks nothing without a difference', () => {
    expect(diffMarkOf(null)).toBeNull();
    expect(diffMarkOf({ box: null, frame: { width: 200, height: 40 } })).toBeNull();
  });

  it('insets the outline from each cell edge by the share of the picture beside the box, one stroke outside it', () => {
    expect(diffMarkOf({ box: { x: 50, y: 10, width: 100, height: 20 }, frame: { width: 200, height: 40 } })).toEqual({
      left: outset('25%'),
      top: outset('25%'),
      right: outset('25%'),
      bottom: outset('25%'),
    });
  });

  it('keeps a box on the cell edge one stroke inside the cell', () => {
    expect(diffMarkOf({ box: { x: 0, y: 0, width: 200, height: 10 }, frame: { width: 200, height: 40 } })).toEqual({
      left: outset('0%'),
      top: outset('0%'),
      right: outset('0%'),
      bottom: outset('75%'),
    });
  });
});
