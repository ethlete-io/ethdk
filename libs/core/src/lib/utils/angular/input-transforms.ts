import { booleanAttribute } from '@angular/core';

/**
 * Like Angular's `booleanAttribute`, but keeps `null` and `undefined` so a tri-state input can tell
 * "not set" apart from `false`. A bare attribute (`<et-x closeOnActivate>`) reads as `true`.
 *
 * @example
 * closeOnActivate = input<boolean | undefined, unknown>(undefined, { transform: optionalBooleanAttribute });
 */
export function optionalBooleanAttribute(value: null): null;
export function optionalBooleanAttribute(value: undefined): undefined;
export function optionalBooleanAttribute(value: unknown): boolean;
export function optionalBooleanAttribute(value: unknown): boolean | null | undefined {
  if (value === null || value === undefined) return value;

  return booleanAttribute(value);
}
