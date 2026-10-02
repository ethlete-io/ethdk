import { numberAttribute } from '@angular/core';

/** `numberAttribute` clamped to a whole number of at least 1; anything unparseable becomes 1. */
export const positiveIntegerAttribute = (value: unknown): number => Math.max(1, Math.trunc(numberAttribute(value, 1)));

/** `numberAttribute` for a step size: zero, negatives and anything unparseable become 1, as for a native `<input type="range">`. */
export const positiveNumberAttribute = (value: unknown) => {
  const parsed = numberAttribute(value, 1);

  return parsed > 0 && Number.isFinite(parsed) ? parsed : 1;
};

/** `numberAttribute` that keeps an absent value absent: `undefined`, `null` and `''` become `undefined`. */
export const optionalNumberAttribute = (value: unknown) =>
  value === undefined || value === null || value === '' ? undefined : numberAttribute(value);

/** `numberAttribute` for an input whose empty state is `null`: `undefined`, `null` and `''` become `null`. */
export const nullableNumberAttribute = (value: unknown) =>
  value === undefined || value === null || value === '' ? null : numberAttribute(value);
