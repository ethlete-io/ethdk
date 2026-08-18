export type PointerFractionOptions = {
  /** The pointer's position along the axis, in client coordinates. */
  position: number;
  /** The axis start, in client coordinates. */
  start: number;
  /** The axis length. */
  size: number;
};

/**
 * Where a pointer sits along one axis of a picker surface, as a 0-1 fraction from the axis start.
 *
 * Deliberately not mirrored for RTL, unlike the slider: the gradients paint left to right in every
 * direction, so mirroring the reading would put the value and the picture it is read off at odds.
 */
export const fractionFromPointer = (options: PointerFractionOptions) => {
  if (options.size <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (options.position - options.start) / options.size));
};
