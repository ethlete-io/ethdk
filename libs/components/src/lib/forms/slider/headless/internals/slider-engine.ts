export type SliderBounds = {
  min: number;
  max: number;
};

export type SliderSteppedBounds = SliderBounds & {
  step: number;
};

/** Decimal places needed to represent `value` exactly — used to strip float noise after step math. */
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
  trackRect: Pick<DOMRect, 'left' | 'width'>;
  rtl: boolean;
  bounds: SliderSteppedBounds;
};

/** Resolves the slider value under a pointer position, snapped to the step grid. */
export const valueFromPointerPosition = (options: PointerValueOptions) => {
  const { clientX, trackRect, rtl, bounds } = options;

  if (trackRect.width <= 0) {
    return bounds.min;
  }

  const fraction = clampValue((clientX - trackRect.left) / trackRect.width, { min: 0, max: 1 });
  const directedFraction = rtl ? 1 - fraction : fraction;

  return snapValueToStep(bounds.min + directedFraction * (bounds.max - bounds.min), bounds);
};

/**
 * The thumb a track interaction should move: the one closest to the target value.
 * Coincident thumbs tie-break by drag direction — a target above the shared value
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
  /** Minimum gap kept between the two thumbs — should be a multiple of `step`. */
  minDistance: number;
};

/** Keeps a range thumb from crossing (or getting closer than `minDistance` to) its sibling. */
export const constrainRangeThumb = (value: number, constraint: RangeThumbConstraint) => {
  const { end, otherValue, minDistance } = constraint;

  return end === 'start' ? Math.min(value, otherValue - minDistance) : Math.max(value, otherValue + minDistance);
};
