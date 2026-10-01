import { ColorPaletteEntry, RegisteredColorThemeName } from '@ethlete/core';

export type ChartSeriesColorSource = {
  colorToken?: RegisteredColorThemeName | null;
};

const MIN_ACCENT_MIX = 40;

export const resolveChartSeriesColors = (
  series: readonly ChartSeriesColorSource[],
  palette: readonly ColorPaletteEntry[] | null | undefined,
): (RegisteredColorThemeName | null)[] => {
  if (series.length < 2) return series.map((entry) => entry.colorToken ?? null);

  return series.map((entry, index) => entry.colorToken ?? palette?.[index]?.token ?? null);
};

export const accentMixSteps = (count: number) =>
  Array.from({ length: count }, (_, step) =>
    count < 2 ? 100 : Math.round(100 - (step * (100 - MIN_ACCENT_MIX)) / (count - 1)),
  );

export const resolveChartAccentMixes = (colors: readonly (RegisteredColorThemeName | null)[]): (number | null)[] => {
  if (colors.length < 2) return colors.map(() => null);

  const steps = accentMixSteps(colors.filter((color) => color === null).length);
  let step = 0;

  return colors.map((color) => (color === null ? (steps[step++] ?? null) : null));
};

export const findSharedSeriesColor = (colors: readonly (RegisteredColorThemeName | null)[]) =>
  colors.find((color, index) => color !== null && colors.indexOf(color) !== index) ?? null;
