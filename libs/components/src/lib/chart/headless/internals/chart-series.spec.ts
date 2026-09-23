import { hasSharedSeriesColor, resolveChartSeriesColors } from './chart-series';

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

describe('hasSharedSeriesColor', () => {
  it('counts the accent as one color', () => {
    expect(hasSharedSeriesColor(['ocean', 'sunset'])).toBe(false);
    expect(hasSharedSeriesColor(['ocean', null, null])).toBe(true);
    expect(hasSharedSeriesColor(['ocean', 'ocean'])).toBe(true);
  });
});
