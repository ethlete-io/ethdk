import { ApplicationRef, inject, signal } from '@angular/core';
import { createRootProvider } from '../utils';

export const [, injectAngularRootElement] = createRootProvider(() => {
  const appRef = inject(ApplicationRef);

  const rootElement = signal<HTMLElement | null>(null);

  setTimeout(() => {
    const appComponents = appRef.components;
    if (appComponents.length > 0) {
      rootElement.set(appComponents[0]?.location.nativeElement);
    }
  });

  return rootElement;
});
