import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

export type PipSlotPlaceholderConfig = {
  /**
   * The color theme name to apply on the back button.
   * When set, applies `[color]` on the button element.
   */
  backButtonColor: string | null;
};

const DEFAULT_PIP_SLOT_PLACEHOLDER_CONFIG: PipSlotPlaceholderConfig = {
  backButtonColor: null,
};

const PIP_SLOT_PLACEHOLDER_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<PipSlotPlaceholderConfig>(
  DEFAULT_PIP_SLOT_PLACEHOLDER_CONFIG,
  {
    name: 'PipSlotPlaceholderConfig',
  },
);

export const providePipSlotPlaceholderConfig = /* @__PURE__ */ toProvideFn(PIP_SLOT_PLACEHOLDER_CONFIG_DEF);
export const injectPipSlotPlaceholderConfig = /* @__PURE__ */ toInjectFn(PIP_SLOT_PLACEHOLDER_CONFIG_DEF);
