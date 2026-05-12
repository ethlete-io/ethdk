import { createStaticRootProvider } from '@ethlete/core';

export type PipSlotPlaceholderConfig = {
  /** The message displayed in the placeholder overlay. */
  message: string;

  /** The label for the "back to player" button. */
  backLabel: string;

  /**
   * The color theme name to apply on the back button.
   * When set, applies `[color]` on the button element.
   */
  backButtonColor: string | null;

  /**
   * A function to transform text based on the current locale.
   * Use `provideLocale()` to update the locale dynamically.
   */
  transformer: (text: string, locale: string) => string;
};

const DEFAULT_PIP_SLOT_PLACEHOLDER_CONFIG: PipSlotPlaceholderConfig = {
  message: 'Playing in picture-in-picture',
  backLabel: 'Back to player',
  backButtonColor: null,
  transformer: (text: string) => text,
};

export const [providePipSlotPlaceholderConfig, injectPipSlotPlaceholderConfig] =
  createStaticRootProvider<PipSlotPlaceholderConfig>(DEFAULT_PIP_SLOT_PLACEHOLDER_CONFIG, {
    name: 'PipSlotPlaceholderConfig',
  });
