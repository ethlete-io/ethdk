import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings every form control shows, rather than any one control's own. The per-control inputs
 * (`clearLabel`, `mixedLabel`) still win where a specific instance needs different wording.
 */
export type FormFieldLabels = {
  /** Placeholder standing in for values that disagree across a bulk edit (`mixed`). */
  mixed: string;
  /** Accessible label for a control's clear-value button. */
  clear: string;
  /** The select-all row of a checkbox group (`<et-checkbox-group-select-all>`) and a multi `et-select` (`selectAll`). */
  selectAll: string;
  /** A rating's `aria-valuetext` while it holds no value. */
  ratingEmpty: string;
  /** A rating's `aria-valuetext` for a value out of its `max`, e.g. `'3 of 5'`. */
  ratingValue: (value: number, max: number) => string;
  /** The `et-counter` announcement once the value nears its limit. */
  counterRemaining: (remaining: number, max: number) => string;
  /** The `et-counter` announcement when the value is exactly at its limit. */
  counterLimitReached: (max: number) => string;
  /** The `et-counter` announcement past the limit. */
  counterOverLimit: (over: number, max: number) => string;
  /** Error text for a `required` validator without a `message`. */
  errorRequired: string;
  /** Error text for a `min` validator without a `message`. */
  errorMin: (error: { min: number }) => string;
  /** Error text for a `max` validator without a `message`. */
  errorMax: (error: { max: number }) => string;
  /** Error text for a `minLength` validator without a `message`. */
  errorMinLength: (error: { minLength: number }) => string;
  /** Error text for a `maxLength` validator without a `message`. */
  errorMaxLength: (error: { maxLength: number }) => string;
  /** Error text for a `pattern` validator without a `message`. */
  errorPattern: (error: { pattern: RegExp }) => string;
  /** Error text for an `email` validator without a `message`. */
  errorEmail: string;
};

/** The built-in English labels. */
export const DEFAULT_FORM_FIELD_LABELS: FormFieldLabels = {
  mixed: 'Mixed',
  clear: 'Clear',
  selectAll: 'Select all',
  ratingEmpty: 'No rating',
  ratingValue: (value, max) => `${value} of ${max}`,
  counterRemaining: (remaining) => `${remaining} characters remaining`,
  counterLimitReached: (max) => `Character limit of ${max} reached`,
  counterOverLimit: (over, max) => `${over} characters over the limit of ${max}`,
  errorRequired: 'This field is required',
  errorMin: (error) => `Must be at least ${error.min}`,
  errorMax: (error) => `Must be at most ${error.max}`,
  errorMinLength: (error) => `Must be at least ${error.minLength} characters`,
  errorMaxLength: (error) => `Must be at most ${error.maxLength} characters`,
  errorPattern: () => 'Invalid format',
  errorEmail: 'Enter a valid email address',
};

const FORM_FIELD_LABELS_DEF = /* @__PURE__ */ defineLabels<FormFieldLabels>(
  'FORM_FIELD_LABELS',
  DEFAULT_FORM_FIELD_LABELS,
);

/**
 * Localize the strings shared by every form control below this injector, and read the set in effect here
 * as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_FORM_FIELD_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideFormFieldLabels({ mixed: 'Gemischt', clear: 'Leeren', selectAll: 'Alle auswählen' });
 */
export const provideFormFieldLabels = /* @__PURE__ */ toProvideFn(FORM_FIELD_LABELS_DEF);
export const injectFormFieldLabels = /* @__PURE__ */ toInjectFn(FORM_FIELD_LABELS_DEF);
export const FORM_FIELD_LABELS = /* @__PURE__ */ toToken(FORM_FIELD_LABELS_DEF);
