import { ColorPaletteEntry, RegisteredColorThemeName } from '@ethlete/core';

export type ChartSeriesColorSource = {
  colorToken?: RegisteredColorThemeName | null;
};

export const resolveChartSeriesColors = (
  series: readonly ChartSeriesColorSource[],
  palette: readonly ColorPaletteEntry[] | null | undefined,
): (RegisteredColorThemeName | null)[] => {
  if (series.length < 2) return series.map((entry) => entry.colorToken ?? null);

  return series.map((entry, index) => entry.colorToken ?? palette?.[index]?.token ?? null);
};

export const hasSharedSeriesColor = (colors: readonly (RegisteredColorThemeName | null)[]) =>
  new Set(colors).size < colors.length;
