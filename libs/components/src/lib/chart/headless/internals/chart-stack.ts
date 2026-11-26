export type ChartStackSegment = {
  start: number;
  end: number;
  isOuter: boolean;
};

const finiteOrZero = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const stackValues = (values: readonly (number | null | undefined)[]): ChartStackSegment[] => {
  let positive = 0;
  let negative = 0;
  let outerPositive = -1;
  let outerNegative = -1;

  const segments = values.map((raw, index) => {
    const value = finiteOrZero(raw);

    if (value > 0) outerPositive = index;
    if (value < 0) outerNegative = index;

    if (value < 0) {
      const segment = { start: negative, end: negative + value, isOuter: false };

      negative += value;

      return segment;
    }

    const segment = { start: positive, end: positive + value, isOuter: false };

    positive += value;

    return segment;
  });

  return segments.map((segment, index) => ({
    ...segment,
    isOuter: index === outerPositive || index === outerNegative,
  }));
};

export const stackExtent = (categories: readonly (readonly (number | null | undefined)[])[]): number[] =>
  categories.flatMap((values) => {
    const segments = stackValues(values);

    return [Math.max(0, ...segments.map((s) => s.end)), Math.min(0, ...segments.map((s) => s.end))];
  });
