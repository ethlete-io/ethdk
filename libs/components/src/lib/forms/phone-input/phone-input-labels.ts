import { createLabels } from '@ethlete/core';

/**
 * The strings the phone input renders itself. The country *names* are not here — they come from
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

/**
 * Localize the phone input's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial — whatever you leave out keeps its {@link DEFAULT_PHONE_INPUT_LABELS} value. See {@link createLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * providePhoneInputLabels({ selectCountry: 'Land auswählen' });
 */
export const [providePhoneInputLabels, injectPhoneInputLabels, PHONE_INPUT_LABELS] = createLabels<PhoneInputLabels>(
  'PHONE_INPUT_LABELS',
  DEFAULT_PHONE_INPUT_LABELS,
);
