import { ChartTooltipPlacement } from '../../chart.types';

export type ChartPoint = {
  x: number;
  y: number;
};

/** Angles are in radians, clockwise from 12 o'clock. */
export type ChartArcOptions = {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  startAngle: number;
  endAngle: number;
  /** The width of the straight gap cut along each radial edge, split evenly between the two neighbours. */
  gap: number;
};

const TAU = 6.283185307179586;
const FULL_CIRCLE_EPSILON = 1e-9;

const formatCoordinate = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;

  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const formatPoint = (point: ChartPoint) => `${formatCoordinate(point.x)},${formatCoordinate(point.y)}`;

export type ChartPolarPoint = {
  radius: number;
  /** Radians, clockwise from 12 o'clock. */
  angle: number;
};

export const createArcPoint = (center: ChartPoint, polar: ChartPolarPoint): ChartPoint => ({
  x: center.x + polar.radius * Math.sin(polar.angle),
  y: center.y - polar.radius * Math.cos(polar.angle),
});

const createCirclePath = (center: ChartPoint, options: { radius: number; sweep: 0 | 1 }) => {
  const { radius, sweep } = options;
  const top = formatPoint({ x: center.x, y: center.y - radius });
  const bottom = formatPoint({ x: center.x, y: center.y + radius });
  const r = formatCoordinate(radius);

  return `M${top}A${r},${r} 0 1 ${sweep} ${bottom}A${r},${r} 0 1 ${sweep} ${top}Z`;
};

/** A gap wider than a thin slice is narrowed until the slice keeps 1px of outer arc. */
export const createArcPath = (options: ChartArcOptions) => {
  const { outerRadius, startAngle, endAngle } = options;
  const center = { x: options.cx, y: options.cy };
  const innerRadius = Math.max(0, Math.min(options.innerRadius, outerRadius));
  const sweep = endAngle - startAngle;

  if (!(sweep > 0) || !(outerRadius > 0)) return '';

  if (sweep >= TAU - FULL_CIRCLE_EPSILON) {
    const outer = createCirclePath(center, { radius: outerRadius, sweep: 1 });

    return innerRadius > 0 ? `${outer}${createCirclePath(center, { radius: innerRadius, sweep: 0 })}` : outer;
  }

  const minSweep = Math.min(sweep, 1 / outerRadius);
  const halfGap = Math.max(0, options.gap) / 2;
  const outerPad = Math.max(0, Math.min(Math.asin(Math.min(1, halfGap / outerRadius)), (sweep - minSweep) / 2));
  const effectiveHalfGap = outerRadius * Math.sin(outerPad);

  const outerStart = createArcPoint(center, { radius: outerRadius, angle: startAngle + outerPad });
  const outerEnd = createArcPoint(center, { radius: outerRadius, angle: endAngle - outerPad });
  const outerLarge = sweep - 2 * outerPad > Math.PI ? 1 : 0;
  const r = formatCoordinate(outerRadius);
  const outerArc = `M${formatPoint(outerStart)}A${r},${r} 0 ${outerLarge} 1 ${formatPoint(outerEnd)}`;

  const apexDistance = effectiveHalfGap > 0 ? effectiveHalfGap / Math.sin(sweep / 2) : 0;

  if (innerRadius <= apexDistance) {
    const apex = createArcPoint(center, {
      radius: Math.min(apexDistance, outerRadius),
      angle: (startAngle + endAngle) / 2,
    });

    return `${outerArc}L${formatPoint(apex)}Z`;
  }

  const innerPad = Math.asin(Math.min(1, effectiveHalfGap / innerRadius));
  const innerStart = createArcPoint(center, { radius: innerRadius, angle: startAngle + innerPad });
  const innerEnd = createArcPoint(center, { radius: innerRadius, angle: endAngle - innerPad });
  const innerLarge = sweep - 2 * innerPad > Math.PI ? 1 : 0;
  const ri = formatCoordinate(innerRadius);

  return `${outerArc}L${formatPoint(innerEnd)}A${ri},${ri} 0 ${innerLarge} 0 ${formatPoint(innerStart)}Z`;
};

export const placementForAngle = (angle: number): ChartTooltipPlacement => {
  const degrees = Math.round((((angle % TAU) + TAU) % TAU) * (180 / Math.PI) * 1e6) / 1e6;

  if (degrees < 45 || degrees >= 315) return 'top';
  if (degrees < 135) return 'right';
  if (degrees < 225) return 'bottom';

  return 'left';
};

/** Largest remainder rounding: the whole percentages always add up to exactly 100. */
export const createWholePercentages = (values: readonly number[]): number[] => {
  const positive = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = positive.reduce((sum, value) => sum + value, 0);

  if (!(total > 0)) return positive.map(() => 0);

  const exact = positive.map((value) => (value / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .filter((entry) => entry.remainder > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const entry of byRemainder) {
    if (remaining <= 0) break;

    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remaining--;
  }

  return floors;
};
