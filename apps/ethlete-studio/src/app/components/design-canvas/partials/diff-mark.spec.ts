import { diffMarkOf } from './diff-mark';

describe('diffMarkOf', () => {
  it('marks nothing without a difference', () => {
    expect(diffMarkOf(null)).toBeNull();
    expect(diffMarkOf({ box: null, frame: { width: 200, height: 40 } })).toBeNull();
  });

  it('insets the region from each cell edge by the share of the picture beside the box', () => {
    expect(diffMarkOf({ box: { x: 50, y: 10, width: 100, height: 20 }, frame: { width: 200, height: 40 } })).toEqual({
      left: '25%',
      top: '25%',
      right: '25%',
      bottom: '25%',
    });
  });

  it('sets a box on the cell edge at the cell edge', () => {
    expect(diffMarkOf({ box: { x: 0, y: 0, width: 200, height: 10 }, frame: { width: 200, height: 40 } })).toEqual({
      left: '0%',
      top: '0%',
      right: '0%',
      bottom: '75%',
    });
  });
});
