import { stackValues } from './chart-stack';

export type ChartLinePoint = {
  x: number;
  y: number;
};

export type ChartSeriesBand = {
  start: number;
  end: number;
};

/** `positions` must be ascending. */
export const findNearestIndex = (positions: readonly number[], x: number) => {
  if (!positions.length) return -1;

  let low = 0;
  let high = positions.length - 1;

  while (low < high) {
    const mid = (low + high) >> 1;

    if ((positions[mid] ?? 0) < x) low = mid + 1;
    else high = mid;
  }

  const before = low - 1;

  if (before >= 0 && x - (positions[before] ?? 0) <= (positions[low] ?? 0) - x) return before;

  return low;
};

export const createSliceBounds = (positions: readonly number[], width: number) =>
  positions.map((position, index) => {
    const previous = positions[index - 1];
    const next = positions[index + 1];
    const start = previous === undefined ? 0 : (previous + position) / 2;
    const end = next === undefined ? width : (position + next) / 2;

    return { start, width: Math.max(0, end - start) };
  });

export const splitLineSegments = <T>(points: readonly (T | null)[]): T[][] => {
  const segments: T[][] = [];
  let current: T[] = [];

  for (const point of points) {
    if (point === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }

  if (current.length) segments.push(current);

  return segments;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** A single-point segment draws nothing - render it as a dot. */
export const createLinePath = (segments: readonly (readonly ChartLinePoint[])[]) =>
  segments
    .filter((segment) => segment.length > 1)
    .map((segment) => segment.map((point, index) => `${index ? 'L' : 'M'}${round(point.x)},${round(point.y)}`).join(''))
    .join('');

export const createAreaPath = (segments: readonly (readonly { x: number; y0: number; y1: number }[])[]) =>
  segments
    .filter((segment) => segment.length > 1)
    .map((segment) => {
      const upper = segment.map((point, index) => `${index ? 'L' : 'M'}${round(point.x)},${round(point.y1)}`).join('');
      const lower = [...segment]
        .reverse()
        .map((point) => `L${round(point.x)},${round(point.y0)}`)
        .join('');

      return `${upper}${lower}Z`;
    })
    .join('');

/** A missing value has no band of its own, and stacks as zero for the series above it. */
export const createSeriesBands = (options: {
  rows: readonly (readonly (number | null)[])[];
  seriesCount: number;
  stacked: boolean;
}): (ChartSeriesBand | null)[][] => {
  const { rows, seriesCount, stacked } = options;
  const bands = Array.from({ length: seriesCount }, () => [] as (ChartSeriesBand | null)[]);

  for (const values of rows) {
    const segments = stacked ? stackValues(values) : null;

    for (let series = 0; series < seriesCount; series++) {
      const value = values[series] ?? null;
      const segment = segments?.[series];

      bands[series]?.push(
        value === null ? null : segment ? { start: segment.start, end: segment.end } : { start: 0, end: value },
      );
    }
  }

  return bands;
};

export const bandExtent = (bands: readonly (readonly (ChartSeriesBand | null)[])[]) =>
  bands.flatMap((series) => series.flatMap((band) => (band ? [band.start, band.end] : [])));
