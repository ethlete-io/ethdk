import { inject, InjectionToken, signal, StaticProvider, WritableSignal } from '@angular/core';

type Locale = { currentLocale: WritableSignal<string> };

const LOCALE = /* @__PURE__ */ new InjectionToken<Locale>('Locale', {
  providedIn: 'root',
  factory: () => ({ currentLocale: signal('en') }),
});

/** Provides the app locale, starting at `locale` (default `'en'`). Change it later with `injectLocale().currentLocale.set(...)`. */
export const provideLocale = (locale?: string): StaticProvider[] => [
  { provide: LOCALE, useFactory: () => ({ currentLocale: signal(locale ?? 'en') }) },
];

export const injectLocale = (): Locale => inject(LOCALE);
