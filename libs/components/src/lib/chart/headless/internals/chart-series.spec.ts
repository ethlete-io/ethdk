import {
  describeSeriesDataMismatch,
  findSharedSeriesColor,
  resolveChartAccentMixes,
  resolveChartSeriesColors,
} from './chart-series';

const PALETTE = [
  { token: 'ocean', label: 'Ocean' },
  { token: 'sunset', label: 'Sunset' },
] as const;

describe('resolveChartSeriesColors', () => {
  it('gives series i palette entry i', () => {
    expect(resolveChartSeriesColors([{}, {}], [...PALETTE])).toEqual(['ocean', 'sunset']);
  });

  it("prefers a series' own color token over its palette entry", () => {
    expect(resolveChartSeriesColors([{ colorToken: 'forest' }, {}], [...PALETTE])).toEqual(['forest', 'sunset']);
  });

  it('falls back to the accent past the end of the palette, and without one', () => {
    expect(resolveChartSeriesColors([{}, {}, {}], [...PALETTE])).toEqual(['ocean', 'sunset', null]);
    expect(resolveChartSeriesColors([{}, {}], null)).toEqual([null, null]);
  });

  it('keeps a lone series on the accent instead of the first palette entry', () => {
    expect(resolveChartSeriesColors([{}], [...PALETTE])).toEqual([null]);
    expect(resolveChartSeriesColors([{ colorToken: 'forest' }], [...PALETTE])).toEqual(['forest']);
  });
});

describe('resolveChartAccentMixes', () => {
  it('steps uncovered entries from 100 down to 40', () => {
    expect(resolveChartAccentMixes([null, null, null])).toEqual([100, 70, 40]);
    expect(resolveChartAccentMixes([null, null])).toEqual([100, 40]);
  });

  it('keeps entries with a color at null and steps only the rest', () => {
    expect(resolveChartAccentMixes([null, 'ocean', null])).toEqual([100, null, 40]);
    expect(resolveChartAccentMixes(['ocean', null])).toEqual([null, 100]);
    expect(resolveChartAccentMixes(['ocean', 'sunset'])).toEqual([null, null]);
  });

  it('mixes nothing for a single entry', () => {
    expect(resolveChartAccentMixes([null])).toEqual([null]);
    expect(resolveChartAccentMixes([])).toEqual([]);
  });
});

describe('findSharedSeriesColor', () => {
  it('finds a color token two entries share', () => {
    expect(findSharedSeriesColor(['ocean', 'ocean'])).toBe('ocean');
    expect(findSharedSeriesColor([null, 'sunset', 'ocean', 'sunset'])).toBe('sunset');
  });

  it('does not count entries without a color, which take steps of the accent', () => {
    expect(findSharedSeriesColor(['ocean', null, null])).toBeNull();
    expect(findSharedSeriesColor(['ocean', 'sunset'])).toBeNull();
  });
});

describe('describeSeriesDataMismatch', () => {
  const series = [{ key: 'home' }, { key: 'away' }];

  it('accepts single-series data without series, and series data that covers every key', () => {
    expect(describeSeriesDataMismatch([{ label: 'a', value: 1 }], [])).toBeNull();
    expect(describeSeriesDataMismatch([{ label: 'a', values: { home: 1, away: null } }], series)).toBeNull();
    expect(describeSeriesDataMismatch([], series)).toBeNull();
  });

  it('names series data drawn without series', () => {
    expect(describeSeriesDataMismatch([{ label: 'a', values: { home: 1 } }], [])).toContain('no `series`');
  });

  it('names single-series data drawn with series', () => {
    expect(describeSeriesDataMismatch([{ label: 'a', value: 1 }], series)).toContain('carries no `values`');
  });

  it('names a series key that no datum carries', () => {
    expect(describeSeriesDataMismatch([{ label: 'a', values: { home: 1, Away: 2 } }], series)).toContain('"away"');
  });
});
