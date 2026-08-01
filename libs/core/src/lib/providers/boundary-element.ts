import { computed, DOCUMENT, ElementRef, inject, signal } from '@angular/core';
import { defineProvider, toInjectFn, toProvideFn, toToken } from '../utils';

const BOUNDARY_ELEMENT_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const hostElement = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
    const document = inject(DOCUMENT);

    const override = signal<HTMLElement | null>(null);

    const value = computed(() => override() ?? hostElement?.nativeElement ?? document.documentElement);

    return {
      value,
      override,
    };
  },
  { name: 'Boundary Element' },
);

export const provideBoundaryElement = /* @__PURE__ */ toProvideFn(BOUNDARY_ELEMENT_DEF);
export const injectBoundaryElement = /* @__PURE__ */ toInjectFn(BOUNDARY_ELEMENT_DEF);
export const BOUNDARY_ELEMENT_TOKEN = /* @__PURE__ */ toToken(BOUNDARY_ELEMENT_DEF);
