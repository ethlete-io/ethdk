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

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_PROGRESS_STEP_LABELS: ProgressStepLabels = {
  complete: 'Abgeschlossen',
  success: 'Erfolgreich',
  warning: 'Warnung',
  error: 'Fehlgeschlagen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideProgressStepLabels}. */
export const progressStepLabelsForLocale = (locale: string): ProgressStepLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_PROGRESS_STEP_LABELS : DEFAULT_PROGRESS_STEP_LABELS;

const PROGRESS_STEP_LABELS_DEF = /* @__PURE__ */ defineLabels<ProgressStepLabels>(
  'PROGRESS_STEP_LABELS',
  progressStepLabelsForLocale,
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
