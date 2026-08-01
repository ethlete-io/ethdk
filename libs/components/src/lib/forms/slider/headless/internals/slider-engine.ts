import { RuntimeError } from '@ethlete/core';
import { SLIDER_ERROR_CODES } from '../../slider-errors';
import { SliderMark, SliderMarkStop, SliderMarks, SliderOrientation } from '../slider.tokens';

export type SliderBounds = {
  min: number;
  max: number;
};

export type SliderSteppedBounds = SliderBounds & {
  step: number;
};

/** Decimal places needed to represent `value` exactly - used to strip float noise after step math. */
const decimalPrecisionOf = (value: number) => {
  const text = value.toString();

  if (text.includes('e-')) {
    return Number(text.split('e-')[1]);
  }

  const fraction = text.split('.')[1];

  return fraction ? fraction.length : 0;
};

export const clampValue = (value: number, bounds: SliderBounds) => Math.min(bounds.max, Math.max(bounds.min, value));

/** Clamps into the bounds and snaps onto the step grid anchored at `min`, without float noise. */
export const snapValueToStep = (value: number, bounds: SliderSteppedBounds) => {
  const { min, max, step } = bounds;

  if (max <= min) {
    return min;
  }

  const stepped = min + Math.round((clampValue(value, bounds) - min) / step) * step;
  const precision = Math.max(decimalPrecisionOf(step), decimalPrecisionOf(min));
  const rounded = Number(stepped.toFixed(precision));

  return clampValue(rounded, bounds);
};

/** Position of `value` inside the bounds as a 0–100 percentage. */
export const valueToPercent = (value: number, bounds: SliderBounds) => {
  const { min, max } = bounds;

  if (max <= min) {
    return 0;
  }

  return clampValue(((value - min) / (max - min)) * 100, { min: 0, max: 100 });
};

export type PointerValueOptions = {
  clientX: number;
  clientY: number;
  trackRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  /** Mirrors a horizontal track. Vertical tracks are never mirrored (ARIA/W3C convention). */
  rtl: boolean;
  orientation: SliderOrientation;
  bounds: SliderSteppedBounds;
};

/** Resolves the slider value under a pointer position, snapped to the step grid. */
export const valueFromPointerPosition = (options: PointerValueOptions) => {
  const { clientX, clientY, trackRect, rtl, orientation, bounds } = options;
  const vertical = orientation === 'vertical';
  const extent = vertical ? trackRect.height : trackRect.width;

  if (extent <= 0) {
    return bounds.min;
  }

  // a vertical track runs bottom→up: its minimum sits at the bottom edge
  const offset = vertical ? trackRect.top + trackRect.height - clientY : clientX - trackRect.left;
  const fraction = clampValue(offset / extent, { min: 0, max: 1 });
  const directedFraction = rtl && !vertical ? 1 - fraction : fraction;

  return snapValueToStep(bounds.min + directedFraction * (bounds.max - bounds.min), bounds);
};

/**
 * The thumb a track interaction should move: the one closest to the target value.
 * Coincident thumbs tie-break by drag direction - a target above the shared value
 * picks the later thumb so the pair can spread apart.
 */
export const nearestThumbIndex = (target: number, values: readonly number[]) => {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  values.forEach((value, index) => {
    const distance = Math.abs(value - target);

    if (distance < nearestDistance || (distance === nearestDistance && target > value)) {
      nearest = index;
      nearestDistance = distance;
    }
  });

  return nearest;
};

export type RangeThumbConstraint = {
  /** Which end of the range the thumb controls. */
  end: 'start' | 'end';
  /** The other thumb's current value. */
  otherValue: number;
  /** Minimum gap kept between the two thumbs - should be a multiple of `step`. */
  minDistance: number;
};

/** Keeps a range thumb from crossing (or getting closer than `minDistance` to) its sibling. */
export const constrainRangeThumb = (value: number, constraint: RangeThumbConstraint) => {
  const { end, otherValue, minDistance } = constraint;

  return end === 'start' ? Math.min(value, otherValue - minDistance) : Math.max(value, otherValue + minDistance);
};

/** Upper bound on how many ticks `marks: true` may generate before it becomes a DOM problem. */
export const MAX_GENERATED_MARKS = 200;

// `ngDevMode` is undefined outside an Angular runtime (pure unit specs) - treat that as dev
const isDevMode = () => typeof ngDevMode === 'undefined' || !!ngDevMode;

/**
 * The tick stops in effect: ascending, inside the bounds and de-duplicated.
 * `true` derives one tick per `step` (plus one at an off-grid `max`).
 */
export const resolveMarks = (marks: SliderMarks, bounds: SliderSteppedBounds): readonly SliderMark[] => {
  const { min, max, step } = bounds;

  if (!marks || max <= min || step <= 0) {
    return [];
  }

  if (marks !== true) {
    const seen = new Set<number>();

    return marks
      .filter((mark) => mark.value >= min && mark.value <= max)
      .sort((a, b) => a.value - b.value)
      .filter((mark) => {
        if (seen.has(mark.value)) {
          return false;
        }

        seen.add(mark.value);

        return true;
      });
  }

  const count = Math.floor((max - min) / step);

  if (isDevMode() && count + 1 > MAX_GENERATED_MARKS) {
    throw new RuntimeError(
      SLIDER_ERROR_CODES.MARKS_TOO_DENSE,
      `A slider with marks="true" would render ${count + 1} ticks for step ${step} over ${min}–${max} (the limit is ${MAX_GENERATED_MARKS}). Raise the step or pass an explicit marks array.`,
    );
  }

  const stops: SliderMark[] = [];

  for (let index = 0; index <= count; index++) {
    stops.push({ value: snapValueToStep(min + index * step, bounds) });
  }

  // a max that is off the step grid still gets a tick - the track visibly ends there
  if (stops[stops.length - 1]?.value !== max) {
    stops.push({ value: max });
  }

  return stops;
};

export type MarkStopOptions = {
  bounds: SliderBounds;
  /** The filled part of the track - marks inside it are flagged active. `null` flags none. */
  activeRange: readonly [number, number] | null;
};

/** Positions marks on the track and flags the ones inside the active range. */
export const toMarkStops = (marks: readonly SliderMark[], options: MarkStopOptions): readonly SliderMarkStop[] => {
  const { bounds, activeRange } = options;

  return marks.map((mark) => ({
    ...mark,
    percent: valueToPercent(mark.value, bounds),
    active: activeRange !== null && mark.value >= activeRange[0] && mark.value <= activeRange[1],
  }));
};

/** Which marks a snap may land on: the nearest one, or the nearest at/below (`down`) / at/above (`up`). */
export type MarkSnapDirection = 'nearest' | 'down' | 'up';

export type MarkSnapOptions = {
  /** The mark grid, ascending. */
  markValues: readonly number[];
  /** Restricts the result to marks at or below / above the value. Defaults to the nearest mark. */
  direction?: MarkSnapDirection;
};

/** Snaps onto the mark grid, or returns `value` unchanged when there are no marks. */
export const snapValueToMarks = (value: number, options: MarkSnapOptions) => {
  const { markValues, direction = 'nearest' } = options;
  const first = markValues[0];
  const last = markValues[markValues.length - 1];

  if (first === undefined || last === undefined) {
    return value;
  }

  if (direction === 'down') {
    for (let index = markValues.length - 1; index >= 0; index--) {
      const mark = markValues[index];

      if (mark !== undefined && mark <= value) {
        return mark;
      }
    }

    return first;
  }

  if (direction === 'up') {
    return markValues.find((mark) => mark >= value) ?? last;
  }

  return markValues.reduce(
    (nearest, mark) => (Math.abs(mark - value) < Math.abs(nearest - value) ? mark : nearest),
    first,
  );
};

export type AdjacentMarkOptions = {
  /** The mark grid, ascending. */
  markValues: readonly number[];
  /** How many marks to move - negative moves towards the minimum. */
  steps: number;
};

/** The mark `steps` positions away from the one nearest `value`, clamped to the ends. */
export const adjacentMarkValue = (value: number, options: AdjacentMarkOptions) => {
  const { markValues, steps } = options;

  if (!markValues.length) {
    return value;
  }

  const current = markValues.indexOf(snapValueToMarks(value, { markValues }));
  const next = clampValue(current + steps, { min: 0, max: markValues.length - 1 });

  return markValues[next] ?? value;
};
