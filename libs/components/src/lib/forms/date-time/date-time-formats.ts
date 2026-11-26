import { computed, effect, InjectionToken, Provider, Signal, inject, untracked } from '@angular/core';
import { defineStaticRootProvider, injectLocale, toInjectFn, toProvideFn } from '@ethlete/core';
import { Locale } from 'date-fns';

/**
 * The wire format the date-only controls (`et-date-input`, `et-date-range-input`) read and write
 * their string values in (a date-fns format string). Defaults to `yyyy-MM-dd`.
 */
export const DATE_FORMAT = new InjectionToken<string>('DATE_FORMAT', {
  providedIn: 'root',
  factory: () => 'yyyy-MM-dd',
});

/**
 * The wire format the date-time controls (`et-date-time-input`, `et-date-time-range-input`) read
 * and write their string values in. Defaults to ISO 8601 with offset.
 */
export const DATE_TIME_FORMAT = new InjectionToken<string>('DATE_TIME_FORMAT', {
  providedIn: 'root',
  factory: () => "yyyy-MM-dd'T'HH:mm:ssxxx",
});

/** The wire format time controls read and write their string values in. */
export const TIME_FORMAT = new InjectionToken<string>('TIME_FORMAT', {
  providedIn: 'root',
  factory: () => 'HH:mm',
});

/** A date-fns locale, or a function that picks one from the app locale (`injectLocale().currentLocale`). */
export type DateLocaleSource = Locale | null | ((locale: string) => Locale | null);

const DATE_LOCALE_SOURCE = new InjectionToken<DateLocaleSource>('DATE_LOCALE_SOURCE', {
  providedIn: 'root',
  factory: () => null,
});

const resolveDateLocale = (source: DateLocaleSource, locale: string) =>
  typeof source === 'function' ? source(locale) : source;

/**
 * The date-fns `Locale` used for display formatting and calendar labels.
 * `null` falls back to date-fns' built-in default (en-US).
 *
 * With a static `provideDateLocale(de)` it does not follow `provideLocale()`: an app that sets
 * `provideLocale('de')` must also `provideDateLocale(de)`, or pass a function to `provideDateLocale`.
 * {@link injectDateLocale} warns in dev mode when neither is set. For a function source this token holds
 * the locale resolved at first read; use {@link injectDateLocaleSignal} to follow later changes.
 */
export const DATE_LOCALE = new InjectionToken<Locale | null>('DATE_LOCALE', {
  providedIn: 'root',
  factory: () => {
    const source = inject(DATE_LOCALE_SOURCE);
    const { currentLocale } = injectLocale();

    return untracked(() => resolveDateLocale(source, currentLocale()));
  },
});

export const provideDateFormat = (format: string): Provider => ({ provide: DATE_FORMAT, useValue: format });

export const provideDateTimeFormat = (format: string): Provider => ({ provide: DATE_TIME_FORMAT, useValue: format });

export const provideTimeFormat = (format: string): Provider => ({ provide: TIME_FORMAT, useValue: format });

/**
 * Sets the date-fns locale of every date control. Pass a `Locale`, or a function `(locale) => Locale` that
 * is re-run whenever `injectLocale().currentLocale` changes so dates follow a live language switch.
 * A control's own `locale` input wins.
 *
 * @example
 * provideDateLocale((locale) => (locale.startsWith('de') ? de : enUS));
 */
export const provideDateLocale = (locale: DateLocaleSource): Provider[] => [
  { provide: DATE_LOCALE_SOURCE, useValue: locale },
];

const DATE_TIME_ZONE_DEF = /* @__PURE__ */ defineStaticRootProvider<string | null>(null, { name: 'DateTimeZone' });

const provideDateTimeZoneValue = /* @__PURE__ */ toProvideFn(DATE_TIME_ZONE_DEF);

/**
 * The IANA zone (`'UTC'`, `'Europe/Berlin'`) every `et-date-input`, `et-date-range-input`,
 * `et-date-time-input` and `et-date-time-range-input` reads and writes its wall clock in. A control's
 * own `timeZone` input wins; `[timeZone]="null"` keeps the runtime's zone.
 */
export const provideDateTimeZone = (zone: string) => provideDateTimeZoneValue(zone);

/** The zone {@link provideDateTimeZone} set, or `null` for the runtime's own zone. */
export const injectDateTimeZone = /* @__PURE__ */ toInjectFn(DATE_TIME_ZONE_DEF);

export const injectDateFormat = () => inject(DATE_FORMAT);

export const injectDateTimeFormat = () => inject(DATE_TIME_FORMAT);

export const injectTimeFormat = () => inject(TIME_FORMAT);

let warnedAboutMissingDateLocale = false;

/** The date-fns locale as a signal that follows `injectLocale().currentLocale` for a function source. */
export const injectDateLocaleSignal = (): Signal<Locale | null> => {
  const source = inject(DATE_LOCALE_SOURCE);
  const direct = inject(DATE_LOCALE);
  const { currentLocale } = injectLocale();

  const dateLocale = computed(() => (source === null ? direct : resolveDateLocale(source, currentLocale())));

  if (ngDevMode) {
    effect(() => {
      const locale = currentLocale();

      if (dateLocale() || warnedAboutMissingDateLocale || locale.toLowerCase().startsWith('en')) return;

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

export const injectDateLocale = () => {
  const dateLocale = injectDateLocaleSignal();

  return untracked(dateLocale);
};
