import { signal } from '@angular/core';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';

const LOCALE_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const currentLocale = signal('en');

    return {
      currentLocale,
    };
  },
  {
    name: 'Locale',
  },
);

export const provideLocale = /* @__PURE__ */ toProvideFn(LOCALE_DEF);
export const injectLocale = /* @__PURE__ */ toInjectFn(LOCALE_DEF);
