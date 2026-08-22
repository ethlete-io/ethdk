import { numberAttribute } from '@angular/core';

/** `numberAttribute` clamped to a whole number of at least 1; anything unparseable becomes 1. */
export const positiveIntegerAttribute = (value: unknown): number => Math.max(1, Math.trunc(numberAttribute(value, 1)));
