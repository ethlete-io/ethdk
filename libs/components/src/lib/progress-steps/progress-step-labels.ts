import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The text a progress step announces for a resolved state, which its marker otherwise shows only as an icon. */
export type ProgressStepLabels = {
  complete: string;
  success: string;
  warning: string;
  error: string;
};

/** The built-in English labels. */
export const DEFAULT_PROGRESS_STEP_LABELS: ProgressStepLabels = {
  complete: 'Completed',
  success: 'Succeeded',
  warning: 'Warning',
  error: 'Failed',
};

const PROGRESS_STEP_LABELS_DEF = /* @__PURE__ */ defineLabels<ProgressStepLabels>(
  'PROGRESS_STEP_LABELS',
  DEFAULT_PROGRESS_STEP_LABELS,
);

/**
 * Localize the state text of every progress step below this injector. Partial - whatever you leave out keeps
 * its {@link DEFAULT_PROGRESS_STEP_LABELS} value.
 *
 * @example
 * provideProgressStepLabels({ complete: 'Abgeschlossen', error: 'Fehlgeschlagen' });
 */
export const provideProgressStepLabels = /* @__PURE__ */ toProvideFn(PROGRESS_STEP_LABELS_DEF);
export const injectProgressStepLabels = /* @__PURE__ */ toInjectFn(PROGRESS_STEP_LABELS_DEF);
export const PROGRESS_STEP_LABELS = /* @__PURE__ */ toToken(PROGRESS_STEP_LABELS_DEF);
