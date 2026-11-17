import { diffMarkOf } from './diff-mark';

describe('diffMarkOf', () => {
  it('marks nothing without a difference', () => {
    expect(diffMarkOf(null)).toBeNull();
    expect(diffMarkOf({ box: null, frame: { width: 200, height: 40 } })).toBeNull();
  });

  it('places the outline in shares of the picture the box was found in', () => {
    expect(diffMarkOf({ box: { x: 50, y: 10, width: 100, height: 20 }, frame: { width: 200, height: 40 } })).toEqual({
      left: '25%',
      top: '25%',
      width: '50%',
      height: '50%',
    });
  });
});
