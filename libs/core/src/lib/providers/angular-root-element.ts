import { ApplicationRef, inject, signal } from '@angular/core';
import { defineRootProvider, toInjectFn } from '../utils';

const ANGULAR_ROOT_ELEMENT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const appRef = inject(ApplicationRef);

  const rootElement = signal<HTMLElement | null>(null);

  const poll = () => {
    const appComponents = appRef.components;
    if (appComponents.length > 0) {
      rootElement.set(appComponents[0]?.location.nativeElement);
    } else {
      setTimeout(poll, 25);
    }
  };

  setTimeout(poll);

  return rootElement;
});

export const injectAngularRootElement = /* @__PURE__ */ toInjectFn(ANGULAR_ROOT_ELEMENT_DEF);
