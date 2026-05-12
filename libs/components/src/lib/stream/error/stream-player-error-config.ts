import { createStaticRootProvider } from '@ethlete/core';

export type StreamPlayerErrorConfig = {
  /** The heading displayed in the error overlay. */
  heading: string;

  /** The description text displayed below the heading. */
  description: string;

  /** The label for the retry button. */
  retryLabel: string;

  /**
   * The color theme name to apply on the retry button.
   * When set, applies `[color]` on the button element.
   */
  retryButtonColor: string | null;

  /**
   * A function to transform text based on the current locale.
   * Use `provideLocale()` to update the locale dynamically.
   */
  transformer: (text: string, locale: string) => string;
};

const DEFAULT_STREAM_PLAYER_ERROR_CONFIG: StreamPlayerErrorConfig = {
  heading: 'Playback failed',
  description: 'The player could not be loaded. Please check your connection or try again.',
  retryLabel: 'Retry',
  retryButtonColor: null,
  transformer: (text: string) => text,
};

export const [provideStreamPlayerErrorConfig, injectStreamPlayerErrorConfig] =
  createStaticRootProvider<StreamPlayerErrorConfig>(DEFAULT_STREAM_PLAYER_ERROR_CONFIG, {
    name: 'StreamPlayerErrorConfig',
  });
