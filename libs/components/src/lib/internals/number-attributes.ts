import { numberAttribute } from '@angular/core';

/** `numberAttribute` clamped to a whole number of at least 1; anything unparseable becomes 1. */
export const positiveIntegerAttribute = (value: unknown): number => Math.max(1, Math.trunc(numberAttribute(value, 1)));

/** `numberAttribute` for a step size: zero, negatives and anything unparseable become 1, as for a native `<input type="range">`. */
export const positiveNumberAttribute = (value: unknown) => {
  const parsed = numberAttribute(value, 1);

  return parsed > 0 && Number.isFinite(parsed) ? parsed : 1;
};
