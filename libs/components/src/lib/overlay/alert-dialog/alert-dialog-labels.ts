import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The action labels of the dialogs opened by `createAlertDialogOpener`. Titles and messages are always yours. */
export type AlertDialogLabels = {
  /** The confirm dialog's accepting action. */
  confirm: string;
  /** The confirm dialog's cancelling action. */
  cancel: string;
  /** The alert dialog's only action. */
  acknowledge: string;
};

/** The built-in English labels. */
export const DEFAULT_ALERT_DIALOG_LABELS: AlertDialogLabels = {
  confirm: 'Confirm',
  cancel: 'Cancel',
  acknowledge: 'OK',
};

const ALERT_DIALOG_LABELS_DEF = /* @__PURE__ */ defineLabels<AlertDialogLabels>(
  'ALERT_DIALOG_LABELS',
  DEFAULT_ALERT_DIALOG_LABELS,
);

/**
 * Localize the confirm and alert dialog actions for everything below this injector, and read the set in effect here
 * as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_ALERT_DIALOG_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideAlertDialogLabels({ confirm: 'Bestätigen', cancel: 'Abbrechen' });
 */
export const provideAlertDialogLabels = /* @__PURE__ */ toProvideFn(ALERT_DIALOG_LABELS_DEF);
export const injectAlertDialogLabels = /* @__PURE__ */ toInjectFn(ALERT_DIALOG_LABELS_DEF);
export const ALERT_DIALOG_LABELS = /* @__PURE__ */ toToken(ALERT_DIALOG_LABELS_DEF);
