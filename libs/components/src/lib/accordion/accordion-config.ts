import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

export type AccordionConfig = {
  /** Default for `lastDivider` on every accordion group. An explicit `[lastDivider]` input still wins. */
  lastDivider?: boolean;
};

const ACCORDION_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<AccordionConfig>({}, { name: 'AccordionConfig' });

/**
 * Sets app-wide accordion defaults.
 *
 * @example
 * providers: [provideAccordionConfig({ lastDivider: true })]
 */
export const provideAccordionConfig = /* @__PURE__ */ toProvideFn(ACCORDION_CONFIG_DEF);
export const injectAccordionConfig = /* @__PURE__ */ toInjectFn(ACCORDION_CONFIG_DEF);
