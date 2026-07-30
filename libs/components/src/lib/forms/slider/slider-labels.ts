import { createLabels } from '@ethlete/core';

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

/**
 * Localize a slider's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial — whatever you leave out keeps its {@link DEFAULT_SLIDER_LABELS} value. See {@link createLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideSliderLabels({ minimum: 'Minimum', maximum: 'Maximum' });
 */
export const [provideSliderLabels, injectSliderLabels, SLIDER_LABELS] = createLabels<SliderLabels>(
  'SLIDER_LABELS',
  DEFAULT_SLIDER_LABELS,
);
