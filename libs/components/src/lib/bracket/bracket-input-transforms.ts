import { booleanAttribute, numberAttribute } from '@angular/core';

/** What a numeric input accepts before its transform runs - a bound number, or a static attribute. */
export type OptionalNumberInput = number | string | undefined | null;

/** Likewise for a flag, where a bare attribute (`hideRoundHeaders`) arrives as an empty string. */
export type OptionalBooleanInput = boolean | string | undefined | null;

/**
 * `numberAttribute`, except that an explicit `undefined` stays `undefined` instead of becoming `NaN`.
 *
 * The bracket's layout inputs are overrides on top of a density preset and the shipped defaults, so
 * "not set" has to survive as a value the resolver can fall through.
 *
 * @internal
 */
export const optionalNumberAttribute = (value: OptionalNumberInput): number | undefined =>
  value === undefined || value === null ? undefined : numberAttribute(value);

/** `booleanAttribute` with the same treatment - see {@link optionalNumberAttribute}. @internal */
export const optionalBooleanAttribute = (value: OptionalBooleanInput): boolean | undefined =>
  value === undefined || value === null ? undefined : booleanAttribute(value);
