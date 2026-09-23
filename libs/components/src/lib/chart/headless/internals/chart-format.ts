export type ChartValueFormatter = (value: number) => string;

export const resolveChartValueFormatter = (custom: ChartValueFormatter | null, locale: string): ChartValueFormatter => {
  if (custom) return custom;

  const format = new Intl.NumberFormat(locale);

  return (value) => format.format(value);
};
