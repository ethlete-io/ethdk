export type ChartValueTicks = {
  domain: readonly [number, number];
  step: number;
  ticks: number[];
};

export type ChartBandScale = {
  step: number;
  bandWidth: number;
  bandStart: (index: number) => number;
};

export type ChartBarPathOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  roundedEnd: 'top' | 'bottom';
};

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

export const createValueTicks = (values: readonly number[], count: number): ChartValueTicks => {
  const finite = values.filter((value) => Number.isFinite(value));
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
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

export const createBandScale = (options: {
  count: number;
  width: number;
  maxBandWidth: number;
  gap: number;
}): ChartBandScale => {
  const { count, width, maxBandWidth, gap } = options;
  const step = count > 0 ? width / count : 0;
  const bandWidth = Math.max(0, Math.min(maxBandWidth, step - gap));

  return {
    step,
    bandWidth,
    bandStart: (index: number) => index * step + (step - bandWidth) / 2,
  };
};

export const createBarPath = (options: ChartBarPathOptions) => {
  const { x, y, width, height, roundedEnd } = options;

  if (width <= 0 || height <= 0) return '';

  const r = Math.min(options.radius, width / 2, height);
  const right = x + width;
  const bottom = y + height;

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
};
