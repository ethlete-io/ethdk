import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

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

const STREAM_PLAYER_ERROR_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<StreamPlayerErrorConfig>(
  DEFAULT_STREAM_PLAYER_ERROR_CONFIG,
  {
    name: 'StreamPlayerErrorConfig',
  },
);

export const provideStreamPlayerErrorConfig = /* @__PURE__ */ toProvideFn(STREAM_PLAYER_ERROR_CONFIG_DEF);
export const injectStreamPlayerErrorConfig = /* @__PURE__ */ toInjectFn(STREAM_PLAYER_ERROR_CONFIG_DEF);
