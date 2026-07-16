import { InjectionToken, Provider, inject } from '@angular/core';
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

export const injectDateLocale = () => inject(DATE_LOCALE);
