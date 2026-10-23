import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings a slider announces. A range slider has two thumbs and no visible text, so naming them is
 * the only way a screen reader can tell them apart.
 */
export type SliderLabels = {
  /** Accessible label for a range slider's lower thumb. */
  minimum: string;
  /** Accessible label for a range slider's upper thumb. */
  maximum: string;
};

/** The built-in English labels. */
export const DEFAULT_SLIDER_LABELS: SliderLabels = {
  minimum: 'Minimum',
  maximum: 'Maximum',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_SLIDER_LABELS: SliderLabels = {
  minimum: 'Minimum',
  maximum: 'Maximum',
};

/** The label set for a locale. Anything other than English and German needs {@link provideSliderLabels}. */
export const sliderLabelsForLocale = (locale: string): SliderLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_SLIDER_LABELS : DEFAULT_SLIDER_LABELS;

const SLIDER_LABELS_DEF = /* @__PURE__ */ defineLabels<SliderLabels>('SLIDER_LABELS', sliderLabelsForLocale);

/**
 * Localize a slider's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_SLIDER_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideSliderLabels({ minimum: 'Minimum', maximum: 'Maximum' });
 */
export const provideSliderLabels = /* @__PURE__ */ toProvideFn(SLIDER_LABELS_DEF);
export const injectSliderLabels = /* @__PURE__ */ toInjectFn(SLIDER_LABELS_DEF);
export const SLIDER_LABELS = /* @__PURE__ */ toToken(SLIDER_LABELS_DEF);
