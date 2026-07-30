import { createStaticRootProvider } from '@ethlete/core';

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

export const [providePipSlotPlaceholderConfig, injectPipSlotPlaceholderConfig] =
  createStaticRootProvider<PipSlotPlaceholderConfig>(DEFAULT_PIP_SLOT_PLACEHOLDER_CONFIG, {
    name: 'PipSlotPlaceholderConfig',
  });
