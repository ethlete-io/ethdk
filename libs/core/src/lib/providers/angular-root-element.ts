import { ApplicationRef, DestroyRef, inject, signal } from '@angular/core';
import { defineRootProvider, toInjectFn } from '../utils';

const ANGULAR_ROOT_ELEMENT_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const appRef = inject(ApplicationRef);
    const destroyRef = inject(DestroyRef);

    const rootElement = signal<HTMLElement | null>(null);
    let pollId: ReturnType<typeof setTimeout> | null = null;

    const poll = () => {
      const appComponents = appRef.components;
      if (appComponents.length > 0) {
        rootElement.set(appComponents[0]?.location.nativeElement);
      } else {
        pollId = setTimeout(poll, 25);
      }
    };

    pollId = setTimeout(poll);
    destroyRef.onDestroy(() => {
      if (pollId !== null) clearTimeout(pollId);
    });

    return rootElement;
  },
  { name: 'Angular Root Element' },
);

export const injectAngularRootElement = /* @__PURE__ */ toInjectFn(ANGULAR_ROOT_ELEMENT_DEF);
