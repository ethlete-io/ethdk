import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

export type FloatingActionConfig = {
  /** Default for `scrollToTopOnlyUp` on every floating action. An explicit `[scrollToTopOnlyUp]` input still wins. */
  scrollToTopOnlyUp?: boolean;
};

const FLOATING_ACTION_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<FloatingActionConfig>(
  {},
  { name: 'FloatingActionConfig' },
);

/**
 * Sets app-wide floating action defaults.
 *
 * @example
 * providers: [provideFloatingActionConfig({ scrollToTopOnlyUp: true })]
 */
export const provideFloatingActionConfig = /* @__PURE__ */ toProvideFn(FLOATING_ACTION_CONFIG_DEF);
export const injectFloatingActionConfig = /* @__PURE__ */ toInjectFn(FLOATING_ACTION_CONFIG_DEF);
