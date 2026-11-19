import { InjectionToken, StaticProvider, inject } from '@angular/core';

export const ACCORDION_CONFIG_TOKEN = new InjectionToken<AccordionConfig>('ACCORDION_CONFIG_TOKEN');

export type AccordionConfig = {
  /** Default for `lastDivider` on every accordion group. An explicit `[lastDivider]` input still wins. */
  lastDivider?: boolean;
};

/**
 * Sets app-wide accordion defaults.
 *
 * @example
 * providers: [provideAccordionConfig({ lastDivider: true })]
 */
export const provideAccordionConfig = (config: AccordionConfig): StaticProvider[] => {
  return [{ provide: ACCORDION_CONFIG_TOKEN, useValue: config }];
};

export const injectAccordionConfig = (): AccordionConfig | null => inject(ACCORDION_CONFIG_TOKEN, { optional: true });
