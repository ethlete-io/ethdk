import { effect, InjectionToken, Provider, inject } from '@angular/core';
import { injectLocale } from '@ethlete/core';
import { Locale } from 'date-fns';

/**
 * The wire format date controls read and write their string values in
 * (a date-fns format string). Defaults to ISO 8601 with offset.
 */
export const DATE_FORMAT = new InjectionToken<string>('DATE_FORMAT', {
  providedIn: 'root',
  factory: () => "yyyy-MM-dd'T'HH:mm:ssxxx",
});

/** The wire format time controls read and write their string values in. */
export const TIME_FORMAT = new InjectionToken<string>('TIME_FORMAT', {
  providedIn: 'root',
  factory: () => 'HH:mm',
});

/**
 * The date-fns `Locale` used for display formatting and calendar labels.
 * `null` falls back to date-fns' built-in default (en-US).
 *
 * This is the one piece of localization that cannot follow `provideLocale()` automatically: a date-fns
 * locale is a module with its own formatting rules, not something derivable from a `'de'` tag, and
 * importing every locale to look one up would put all of them in the bundle. So an app that sets
 * `provideLocale('de')` must also `provideDateLocale(de)` - {@link injectDateLocale} warns in dev mode
 * when it hasn't.
 */
export const DATE_LOCALE = new InjectionToken<Locale | null>('DATE_LOCALE', {
  providedIn: 'root',
  factory: () => null,
});

export const provideDateFormat = (format: string): Provider => ({ provide: DATE_FORMAT, useValue: format });

export const provideTimeFormat = (format: string): Provider => ({ provide: TIME_FORMAT, useValue: format });

export const provideDateLocale = (locale: Locale): Provider => ({ provide: DATE_LOCALE, useValue: locale });

export const injectDateFormat = () => inject(DATE_FORMAT);

export const injectTimeFormat = () => inject(TIME_FORMAT);

/**
 * Once per app, not once per control: four directives call {@link injectDateLocale}, and a page with a
 * date input, a range input and a calendar on it would otherwise log the same sentence three times.
 */
let warnedAboutMissingDateLocale = false;

export const injectDateLocale = () => {
  const dateLocale = inject(DATE_LOCALE);

  // The forgotten half of localizing dates: `provideLocale('de')` moves every label in the library, and
  // then the calendar still says "January". Nothing throws - date-fns just keeps its en-US default - so
  // without this it surfaces as a bug report about month names.
  if (ngDevMode && !dateLocale) {
    const { currentLocale } = injectLocale();

    effect(() => {
      const locale = currentLocale();

      if (warnedAboutMissingDateLocale || locale.toLowerCase().startsWith('en')) return;

      warnedAboutMissingDateLocale = true;

      console.warn(
        `[ethlete] provideLocale('${locale}') is set but DATE_LOCALE is not, so dates and calendar ` +
          `names stay in en-US. Import the matching date-fns locale and add ` +
          `provideDateLocale(...) next to provideLocale().`,
      );
    });
  }

  return dateLocale;
};
