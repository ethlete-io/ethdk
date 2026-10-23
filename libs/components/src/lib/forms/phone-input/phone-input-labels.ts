import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings the phone input renders itself. The country *names* are not here - they come from
 * `Intl.DisplayNames` for the current locale, so they are already translated.
 */
export type PhoneInputLabels = {
  /** Accessible label for the country-code selector. */
  selectCountry: string;
  /** Placeholder for the country list's search field. */
  searchCountries: string;
  /** Shown when a country search matched nothing. */
  noCountries: string;
};

/** The built-in English labels. */
export const DEFAULT_PHONE_INPUT_LABELS: PhoneInputLabels = {
  selectCountry: 'Select country',
  searchCountries: 'Search countries',
  noCountries: 'No countries found',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_PHONE_INPUT_LABELS: PhoneInputLabels = {
  selectCountry: 'Land auswählen',
  searchCountries: 'Länder durchsuchen',
  noCountries: 'Keine Länder gefunden',
};

/** The label set for a locale. Anything other than English and German needs {@link providePhoneInputLabels}. */
export const phoneInputLabelsForLocale = (locale: string): PhoneInputLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_PHONE_INPUT_LABELS : DEFAULT_PHONE_INPUT_LABELS;

const PHONE_INPUT_LABELS_DEF = /* @__PURE__ */ defineLabels<PhoneInputLabels>(
  'PHONE_INPUT_LABELS',
  phoneInputLabelsForLocale,
);

/**
 * Localize the phone input's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_PHONE_INPUT_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * providePhoneInputLabels({ selectCountry: 'Land auswählen' });
 */
export const providePhoneInputLabels = /* @__PURE__ */ toProvideFn(PHONE_INPUT_LABELS_DEF);
export const injectPhoneInputLabels = /* @__PURE__ */ toInjectFn(PHONE_INPUT_LABELS_DEF);
export const PHONE_INPUT_LABELS = /* @__PURE__ */ toToken(PHONE_INPUT_LABELS_DEF);
