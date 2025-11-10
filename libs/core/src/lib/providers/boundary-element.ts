import { computed, DOCUMENT, ElementRef, inject, signal } from '@angular/core';
import { createProvider } from '../utils';

export const [provideBoundaryElement, injectBoundaryElement, BOUNDARY_ELEMENT_TOKEN] = createProvider(
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
