import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the carousel announces or renders. Defaults are English
 * ({@link DEFAULT_CAROUSEL_LABELS}); override them app-wide with {@link provideCarouselLabels} or per
 * instance via the `labels` input.
 */
export type CarouselLabels = {
  /** Accessible label for the carousel region. */
  carousel: string;
  /** Accessible label for a slide, e.g. `'3 of 8'`. */
  slide: (index: number, count: number) => string;
  /** Accessible label for the previous control. */
  previous: string;
  /** Accessible label for the next control. */
  next: string;
  /** Accessible label for the control that starts autoplay. */
  play: string;
  /** Accessible label for the control that pauses autoplay. */
  pause: string;
  /** Accessible label for a slide-picker dot, e.g. `'Go to slide 3'`. */
  goToSlide: (index: number, count: number) => string;
};

/** The built-in English labels. */
export const DEFAULT_CAROUSEL_LABELS: CarouselLabels = {
  carousel: 'Carousel',
  slide: (index, count) => `${index} of ${count}`,
  previous: 'Previous slide',
  next: 'Next slide',
  play: 'Start automatic slide show',
  pause: 'Pause automatic slide show',
  goToSlide: (index) => `Go to slide ${index}`,
};

const CAROUSEL_LABELS_DEF = /* @__PURE__ */ defineLabels<CarouselLabels>('CAROUSEL_LABELS', DEFAULT_CAROUSEL_LABELS);

/**
 * Localize the carousel's strings for everything below this injector, and read the set in effect here
 * as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_CAROUSEL_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideCarouselLabels({ previous: 'Vorheriges Bild', next: 'Nächstes Bild' });
 */
export const provideCarouselLabels = /* @__PURE__ */ toProvideFn(CAROUSEL_LABELS_DEF);
export const injectCarouselLabels = /* @__PURE__ */ toInjectFn(CAROUSEL_LABELS_DEF);
export const CAROUSEL_LABELS = /* @__PURE__ */ toToken(CAROUSEL_LABELS_DEF);
