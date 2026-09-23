import {
  bandExtent,
  createAreaPath,
  createLinePath,
  createSeriesBands,
  createSliceBounds,
  findNearestIndex,
  splitLineSegments,
} from './chart-line';

describe('chart line geometry', () => {
  describe('findNearestIndex', () => {
    const positions = [0, 10, 30, 60];

    it('finds the closest position on either side', () => {
      expect(findNearestIndex(positions, -5)).toBe(0);
      expect(findNearestIndex(positions, 4)).toBe(0);
      expect(findNearestIndex(positions, 6)).toBe(1);
      expect(findNearestIndex(positions, 21)).toBe(2);
      expect(findNearestIndex(positions, 44)).toBe(2);
      expect(findNearestIndex(positions, 46)).toBe(3);
      expect(findNearestIndex(positions, 500)).toBe(3);
    });

    it('breaks a tie towards the earlier position', () => {
      expect(findNearestIndex(positions, 5)).toBe(0);
      expect(findNearestIndex(positions, 45)).toBe(2);
    });

    it('returns -1 without positions', () => {
      expect(findNearestIndex([], 10)).toBe(-1);
    });
  });

  describe('createSliceBounds', () => {
    it('splits the plot at the midpoints between neighbours, out to both edges', () => {
      expect(createSliceBounds([10, 30, 90], 100)).toEqual([
        { start: 0, width: 20 },
        { start: 20, width: 40 },
        { start: 60, width: 40 },
      ]);
    });

    it('gives a lone position the whole plot', () => {
      expect(createSliceBounds([50], 100)).toEqual([{ start: 0, width: 100 }]);
    });
  });

  describe('gaps', () => {
    it('breaks a series into runs at every null', () => {
      expect(splitLineSegments([1, 2, null, 3, null, null, 4, 5])).toEqual([[1, 2], [3], [4, 5]]);
      expect(splitLineSegments([null, null])).toEqual([]);
    });

    it('draws one subpath per run and skips runs of a single point', () => {
      const path = createLinePath([
        [
          { x: 0, y: 10 },
          { x: 10, y: 20 },
        ],
        [{ x: 20, y: 5 }],
        [
          { x: 30, y: 0 },
          { x: 40, y: 1.006 },
        ],
      ]);

      expect(path).toBe('M0,10L10,20M30,0L40,1.01');
    });

    it('closes each area run down its lower edge', () => {
      const path = createAreaPath([
        [
          { x: 0, y0: 100, y1: 40 },
          { x: 10, y0: 100, y1: 20 },
        ],
      ]);

      expect(path).toBe('M0,40L10,20L10,100L0,100Z');
    });
  });

  describe('createSeriesBands', () => {
    const rows = [
      [10, 5, -3],
      [20, null, -4],
      [null, 7, 2],
    ];

    it('draws every series from zero when not stacked', () => {
      const bands = createSeriesBands({ rows, seriesCount: 3, stacked: false });

      expect(bands[0]).toEqual([{ start: 0, end: 10 }, { start: 0, end: 20 }, null]);
      expect(bands[2]).toEqual([
        { start: 0, end: -3 },
        { start: 0, end: -4 },
        { start: 0, end: 2 },
      ]);
    });

    it('stacks positives up and negatives down, counting a missing value as zero', () => {
      const bands = createSeriesBands({ rows, seriesCount: 3, stacked: true });

      expect(bands[0]).toEqual([{ start: 0, end: 10 }, { start: 0, end: 20 }, null]);
      expect(bands[1]).toEqual([{ start: 10, end: 15 }, null, { start: 0, end: 7 }]);
      expect(bands[2]).toEqual([
        { start: 0, end: -3 },
        { start: 0, end: -4 },
        { start: 7, end: 9 },
      ]);
    });

    it('spans the stacked totals on the value axis', () => {
      const extent = bandExtent(createSeriesBands({ rows, seriesCount: 3, stacked: true }));

      expect(Math.max(...extent)).toBe(20);
      expect(Math.min(...extent)).toBe(-4);
    });
  });
});
