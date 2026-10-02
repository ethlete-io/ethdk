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

export const describeSeriesDataMismatch = (
  data: readonly object[],
  series: readonly { key: string }[],
): string | null => {
  if (!data.length) return null;

  if (!series.length) {
    return data.some((datum) => 'values' in datum && !('value' in datum))
      ? 'The data carries `values`, but no `series` names them, so every point reads as 0. Pass `series`, or give each datum a `value`.'
      : null;
  }

  const valuesOf = (datum: object) =>
    'values' in datum && typeof datum.values === 'object' && datum.values !== null ? datum.values : null;

  if (data.every((datum) => valuesOf(datum) === null)) {
    return 'The `series` input is set, but the data carries no `values`, so nothing is drawn. Give each datum `values` keyed by series, or drop `series`.';
  }

  const missing = series.find((entry) => !data.some((datum) => entry.key in (valuesOf(datum) ?? {})));

  return missing
    ? `No datum carries a value for the series "${missing.key}", so it draws nothing. Check the key against the data's \`values\`.`
    : null;
};
