import { signal } from '@angular/core';
import { createRootProvider } from '../utils';

export const [provideLocale, injectLocale] = createRootProvider(
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
