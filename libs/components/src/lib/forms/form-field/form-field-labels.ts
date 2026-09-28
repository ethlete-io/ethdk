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
