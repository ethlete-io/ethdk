import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings every form control shows, rather than any one control's own. Both are answers a control
 * gives about its *value*, which is why they recur: a bulk edit masks disagreeing values the same way in
 * a text field and in a slider, and a clearable control offers to empty itself the same way everywhere.
 *
 * One set for all of them on purpose - translating "Clear" once should be enough. The per-control inputs
 * (`clearLabel`, `mixedLabel`) still win where a specific instance needs different wording.
 */
export type FormFieldLabels = {
  /** Placeholder standing in for values that disagree across a bulk edit (`mixed`). */
  mixed: string;
  /** Accessible label for a control's clear-value button. */
  clear: string;
  /** The select-all row above a checkbox group (`<et-checkbox-group-select-all>`). */
  selectAll: string;
};

/** The built-in English labels. */
export const DEFAULT_FORM_FIELD_LABELS: FormFieldLabels = {
  mixed: 'Mixed',
  clear: 'Clear',
  selectAll: 'Select all',
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
