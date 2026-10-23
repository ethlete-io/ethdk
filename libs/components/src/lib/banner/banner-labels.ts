import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings a banner renders itself. Its heading, description and actions are yours; dismissal is its own. */
export type BannerLabels = {
  /** Accessible label for a dismissible banner's dismiss button. */
  dismiss: string;
};

/** The built-in English labels. */
export const DEFAULT_BANNER_LABELS: BannerLabels = {
  dismiss: 'Dismiss',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_BANNER_LABELS: BannerLabels = {
  dismiss: 'Schließen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideBannerLabels}. */
export const bannerLabelsForLocale = (locale: string): BannerLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_BANNER_LABELS : DEFAULT_BANNER_LABELS;

const BANNER_LABELS_DEF = /* @__PURE__ */ defineLabels<BannerLabels>('BANNER_LABELS', bannerLabelsForLocale);

/**
 * Localize a banner's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_BANNER_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideBannerLabels({ dismiss: 'Schließen' });
 */
export const provideBannerLabels = /* @__PURE__ */ toProvideFn(BANNER_LABELS_DEF);
export const injectBannerLabels = /* @__PURE__ */ toInjectFn(BANNER_LABELS_DEF);
export const BANNER_LABELS = /* @__PURE__ */ toToken(BANNER_LABELS_DEF);
