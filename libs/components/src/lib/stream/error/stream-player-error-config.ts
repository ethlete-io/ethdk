import { createStaticRootProvider } from '@ethlete/core';

export type StreamPlayerErrorConfig = {
  /**
   * The color theme name to apply on the retry button.
   * When set, applies `[color]` on the button element.
   */
  retryButtonColor: string | null;
};

const DEFAULT_STREAM_PLAYER_ERROR_CONFIG: StreamPlayerErrorConfig = {
  retryButtonColor: null,
};

export const [provideStreamPlayerErrorConfig, injectStreamPlayerErrorConfig] =
  createStaticRootProvider<StreamPlayerErrorConfig>(DEFAULT_STREAM_PLAYER_ERROR_CONFIG, {
    name: 'StreamPlayerErrorConfig',
  });
