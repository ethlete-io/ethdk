import { createAreaPath, createLinePath, createSeriesBands, findNearestIndex, createSliceBounds } from './chart-line';
import {
  createBandScale,
  createFittedValueTicks,
  createLinearScale,
  createValueTicks,
  numberExtent,
} from './chart-scale';
import { stackExtent, stackValues } from './chart-stack';
import { createArcPath, createWholePercentages } from './chart-arc';

const isFiniteTicks = (ticks: { domain: readonly number[]; step: number; ticks: number[] }) =>
  [...ticks.domain, ticks.step, ...ticks.ticks].every(Number.isFinite);

describe('chart edge cases', () => {
  describe('one point', () => {
    it('gives a single value a value axis that holds it and zero', () => {
      const ticks = createValueTicks([7], 5);

      expect(ticks.domain[0]).toBe(0);
      expect(ticks.domain[1]).toBeGreaterThanOrEqual(7);
      expect(isFiniteTicks(ticks)).toBe(true);
    });

    it('centers a fitted axis around a single value', () => {
      const ticks = createFittedValueTicks([7], 4);

      expect(ticks.domain[0]).toBeLessThan(7);
      expect(ticks.domain[1]).toBeGreaterThan(7);
      expect(isFiniteTicks(ticks)).toBe(true);
    });

    it('slices a single point across the whole plot and finds it from anywhere', () => {
      expect(createSliceBounds([50], 100)).toEqual([{ start: 0, width: 100 }]);
      expect(findNearestIndex([50], 0)).toBe(0);
      expect(findNearestIndex([50], 1000)).toBe(0);
    });

    it('draws no line or area path for a single point', () => {
      expect(createLinePath([[{ x: 1, y: 1 }]])).toBe('');
      expect(createAreaPath([[{ x: 1, y0: 0, y1: 1 }]])).toBe('');
    });

    it('lays out a single bar band inside the plot', () => {
      const scale = createBandScale({ count: 1, width: 200, maxBandWidth: 40, gap: 2 });

      expect(scale.bandWidth).toBe(40);
      expect(scale.bandStart(0)).toBe(80);
    });

    it('gives a single pie slice 100 percent and a full circle', () => {
      expect(createWholePercentages([3])).toEqual([100]);
      expect(
        createArcPath({
          cx: 50,
          cy: 50,
          outerRadius: 40,
          innerRadius: 0,
          startAngle: 0,
          endAngle: Math.PI * 2,
          gap: 2,
        }),
      ).toContain('A40,40');
    });
  });

  describe('all-equal values', () => {
    it.each([5, -5, 0.003, 1e9])('keeps the axis finite and the value inside it for %d', (value) => {
      const values = [value, value, value];

      for (const ticks of [createValueTicks(values, 5), createFittedValueTicks(values, 5)]) {
        expect(isFiniteTicks(ticks)).toBe(true);
        expect(ticks.domain[0]).toBeLessThanOrEqual(value);
        expect(ticks.domain[1]).toBeGreaterThanOrEqual(value);
        expect(ticks.domain[1]).toBeGreaterThan(ticks.domain[0]);
      }
    });

    it('spans a positive axis for all-zero values instead of a zero-height domain', () => {
      for (const ticks of [createValueTicks([0, 0], 4), createFittedValueTicks([0, 0], 4)]) {
        expect(ticks.domain[0]).toBe(0);
        expect(ticks.domain[1]).toBeGreaterThan(0);
      }
    });

    it('maps a degenerate domain to the range start rather than NaN', () => {
      expect(createLinearScale([3, 3], [100, 0])(3)).toBe(100);
    });

    it('splits equal pie values evenly into whole percentages that add up to 100', () => {
      const percentages = createWholePercentages([1, 1, 1]);

      expect(percentages.reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(Math.max(...percentages) - Math.min(...percentages)).toBeLessThanOrEqual(1);
    });
  });

  describe('negative values', () => {
    it('extends the axis below zero for all-negative values', () => {
      const ticks = createValueTicks([-3, -12, -7], 5);

      expect(ticks.domain[0]).toBeLessThanOrEqual(-12);
      expect(ticks.domain[1]).toBe(0);
      expect(ticks.ticks).toContain(0);
    });

    it('fits an all-negative series without dragging zero in', () => {
      const ticks = createFittedValueTicks([-30, -12, -17], 5);

      expect(ticks.domain[0]).toBeLessThanOrEqual(-30);
      expect(ticks.domain[1]).toBeGreaterThanOrEqual(-12);
      expect(ticks.domain[1]).toBeLessThan(0);
    });

    it('stacks negatives downwards and positives upwards from zero', () => {
      const segments = stackValues([4, -2, 3, -5]);

      expect(segments.map(({ start, end }) => [start, end])).toEqual([
        [0, 4],
        [0, -2],
        [4, 7],
        [-2, -7],
      ]);
      expect(stackExtent([[4, -2, 3, -5]])).toEqual([7, -7]);
    });

    it('builds non-stacked bands from zero to a negative value', () => {
      expect(createSeriesBands({ rows: [[-4]], seriesCount: 1, stacked: false })).toEqual([[{ start: 0, end: -4 }]]);
    });

    it('gives negative pie values no share', () => {
      expect(createWholePercentages([-5, 5])).toEqual([0, 100]);
      expect(createWholePercentages([-5, -5])).toEqual([0, 0]);
    });
  });

  describe('NaN and infinite values', () => {
    it('skips non-finite values when building ticks', () => {
      const ticks = createValueTicks([NaN, 4, Infinity, -Infinity], 4);

      expect(isFiniteTicks(ticks)).toBe(true);
      expect(ticks.domain).toEqual([0, 4]);
    });

    it('falls back to a usable axis when every value is NaN', () => {
      for (const ticks of [createValueTicks([NaN, NaN], 4), createFittedValueTicks([NaN], 4)]) {
        expect(isFiniteTicks(ticks)).toBe(true);
        expect(ticks.domain[1]).toBeGreaterThan(ticks.domain[0]);
      }
    });

    it('ignores NaN in an extent, wherever it sits', () => {
      expect(numberExtent([NaN, 3, 1])).toEqual([1, 3]);
      expect(numberExtent([3, NaN, 1])).toEqual([1, 3]);
    });

    it('stacks NaN as zero', () => {
      expect(stackValues([NaN, 2]).map(({ start, end }) => [start, end])).toEqual([
        [0, 0],
        [0, 2],
      ]);
    });

    it('gives NaN and Infinity pie values no share', () => {
      expect(createWholePercentages([NaN, Infinity, 2])).toEqual([0, 0, 100]);
    });
  });
});
