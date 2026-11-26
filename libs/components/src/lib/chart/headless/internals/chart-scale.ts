export type ChartValueTicks = {
  domain: readonly [number, number];
  step: number;
  ticks: number[];
};

export type ChartBandScale = {
  step: number;
  bandWidth: number;
  bandStart: (index: number, member?: number) => number;
  memberSlot: (index: number, member?: number) => { start: number; size: number };
};

export type ChartBandScaleOptions = {
  count: number;
  width: number;
  maxBandWidth: number;
  gap: number;
  groupSize?: number;
};

export type ChartRoundedEnd = 'top' | 'bottom' | 'left' | 'right' | 'none';

export type ChartBarPathOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  roundedEnd: ChartRoundedEnd;
};

const GROUP_PADDING = 0.2;

const roundToStep = (value: number) => Number(value.toPrecision(12));

const niceStep = (span: number, count: number) => {
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const error = rawStep / magnitude;

  if (error >= Math.sqrt(50)) return magnitude * 10;
  if (error >= Math.sqrt(10)) return magnitude * 5;
  if (error >= Math.sqrt(2)) return magnitude * 2;

  return magnitude;
};

/** Loops instead of spreading into `Math.min`, which throws a RangeError past about 100k arguments. */
export const numberExtent = (values: readonly number[]): readonly [number, number] => {
  let min = Infinity;
  let max = -Infinity;

  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return values.length ? [min, max] : [0, 0];
};

export const createValueTicks = (values: readonly number[], count: number) =>
  valueTicks(values, { count, includeZero: true });

export const createFittedValueTicks = (values: readonly number[], count: number) =>
  valueTicks(values, { count, includeZero: false });

const valueTicks = (
  values: readonly number[],
  { count, includeZero }: { count: number; includeZero: boolean },
): ChartValueTicks => {
  let min = includeZero ? 0 : Infinity;
  let max = includeZero ? 0 : -Infinity;

  for (const value of values) {
    if (!Number.isFinite(value)) continue;

    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  if (min > max) min = max = 0;

  if (max === min && min !== 0) {
    const step = niceStep(Math.abs(min), count);
    const domainMin = roundToStep((Math.floor(min / step) - Math.floor(count / 2)) * step);
    const domainMax = roundToStep(domainMin + step * Math.max(1, count));
    const ticks = Array.from({ length: Math.max(1, count) + 1 }, (_, index) => roundToStep(domainMin + index * step));

    return { domain: [domainMin, domainMax], step, ticks };
  }

  const span = max - min || 1;
  const step = niceStep(span, count);
  const domainMin = roundToStep(Math.floor(min / step) * step);
  const domainMax = max === min ? roundToStep(step * Math.max(1, count)) : roundToStep(Math.ceil(max / step) * step);
  const tickCount = Math.round((domainMax - domainMin) / step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => roundToStep(domainMin + index * step));

  return { domain: [domainMin, domainMax], step, ticks };
};

export const createLinearScale =
  (domain: readonly [number, number], range: readonly [number, number]) => (value: number) => {
    const [d0, d1] = domain;
    const [r0, r1] = range;

    if (d1 === d0) return r0;

    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  };

export const createBandScale = (options: ChartBandScaleOptions): ChartBandScale => {
  const { count, width, maxBandWidth, gap } = options;
  const groupSize = Math.max(1, options.groupSize ?? 1);
  const step = count > 0 ? width / count : 0;
  const groupGap = groupSize > 1 ? Math.max(gap, step * GROUP_PADDING) : gap;
  const innerGaps = (groupSize - 1) * gap;
  const bandWidth = Math.max(0, Math.min(maxBandWidth, (step - groupGap - innerGaps) / groupSize));
  const groupWidth = bandWidth * groupSize + innerGaps;

  const bandStart = (index: number, member = 0) => index * step + (step - groupWidth) / 2 + member * (bandWidth + gap);

  const memberSlot = (index: number, member = 0) => {
    const start = member === 0 ? index * step : bandStart(index, member) - gap / 2;
    const end = member === groupSize - 1 ? (index + 1) * step : bandStart(index, member) + bandWidth + gap / 2;

    return { start, size: end - start };
  };

  return { step, bandWidth, bandStart, memberSlot };
};

export const createBarPath = (options: ChartBarPathOptions) => {
  const { x, y, width, height, roundedEnd } = options;

  if (width <= 0 || height <= 0) return '';

  const right = x + width;
  const bottom = y + height;

  if (roundedEnd === 'none') return `M${x},${y}H${right}V${bottom}H${x}Z`;

  if (roundedEnd === 'top' || roundedEnd === 'bottom') {
    const r = Math.min(options.radius, width / 2, height);

    if (roundedEnd === 'top') {
      return (
        `M${x},${bottom}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}` +
        `H${right - r}A${r},${r} 0 0 1 ${right},${y + r}V${bottom}Z`
      );
    }

    return (
      `M${x},${y}H${right}V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}` +
      `H${x + r}A${r},${r} 0 0 1 ${x},${bottom - r}Z`
    );
  }

  const r = Math.min(options.radius, height / 2, width);

  if (roundedEnd === 'right') {
    return (
      `M${x},${y}H${right - r}A${r},${r} 0 0 1 ${right},${y + r}` +
      `V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}H${x}Z`
    );
  }

  return (
    `M${right},${y}V${bottom}H${x + r}A${r},${r} 0 0 1 ${x},${bottom - r}` + `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  );
};
