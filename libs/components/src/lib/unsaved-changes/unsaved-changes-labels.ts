import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings of the dialog `provideUnsavedChangesAlertDialog()` opens. */
export type UnsavedChangesLabels = {
  /** The dialog's heading. */
  title: string;
  /** The dialog's body text. */
  message: string;
  /** The action that throws the changes away. */
  discard: string;
  /** The action that keeps the changes and stays. */
  keepEditing: string;
};

/** The built-in English labels. */
export const DEFAULT_UNSAVED_CHANGES_LABELS: UnsavedChangesLabels = {
  title: 'Discard unsaved changes?',
  message: 'Your changes have not been saved. Leave and discard them?',
  discard: 'Discard',
  keepEditing: 'Keep editing',
};

const UNSAVED_CHANGES_LABELS_DEF = /* @__PURE__ */ defineLabels<UnsavedChangesLabels>(
  'UNSAVED_CHANGES_LABELS',
  DEFAULT_UNSAVED_CHANGES_LABELS,
);

/**
 * Localize the unsaved-changes dialog for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_UNSAVED_CHANGES_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideUnsavedChangesLabels({ title: 'Änderungen verwerfen?', discard: 'Verwerfen', keepEditing: 'Weiter bearbeiten' });
 */
export const provideUnsavedChangesLabels = /* @__PURE__ */ toProvideFn(UNSAVED_CHANGES_LABELS_DEF);
export const injectUnsavedChangesLabels = /* @__PURE__ */ toInjectFn(UNSAVED_CHANGES_LABELS_DEF);
export const UNSAVED_CHANGES_LABELS = /* @__PURE__ */ toToken(UNSAVED_CHANGES_LABELS_DEF);
