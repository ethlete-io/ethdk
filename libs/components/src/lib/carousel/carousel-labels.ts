import { InjectionToken, Provider, inject } from '@angular/core';

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

/** The label set every carousel in this injector uses. @default DEFAULT_CAROUSEL_LABELS */
export const CAROUSEL_LABELS = new InjectionToken<CarouselLabels>('CAROUSEL_LABELS', {
  providedIn: 'root',
  factory: () => DEFAULT_CAROUSEL_LABELS,
});

/**
 * Localize the carousel's strings for everything below this injector. Partial — whatever you leave out
 * keeps its {@link DEFAULT_CAROUSEL_LABELS} value.
 *
 * @example
 * provideCarouselLabels({ previous: 'Vorheriges Bild', next: 'Nächstes Bild' });
 */
export const provideCarouselLabels = (labels: Partial<CarouselLabels>): Provider => ({
  provide: CAROUSEL_LABELS,
  useValue: { ...DEFAULT_CAROUSEL_LABELS, ...labels },
});

export const injectCarouselLabels = () => inject(CAROUSEL_LABELS);
