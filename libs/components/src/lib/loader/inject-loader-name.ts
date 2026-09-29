import { HostAttributeToken, computed, inject } from '@angular/core';
import { injectLoaderLabels } from './loader-labels';

export const injectLoaderName = () => {
  const staticAriaLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  const labels = injectLoaderLabels();

  return computed(() => staticAriaLabel ?? labels().loading);
};
