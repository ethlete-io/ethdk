import { createStaticRootProvider } from '@ethlete/core';

export type StreamPlayerLoadingConfig = {
  /** Diameter of the loading spinner in px. */
  spinnerDiameter: number;

  /** Stroke width of the loading spinner in px. */
  spinnerStrokeWidth: number;
};

const DEFAULT_STREAM_PLAYER_LOADING_CONFIG: StreamPlayerLoadingConfig = {
  spinnerDiameter: 35,
  spinnerStrokeWidth: 2,
};

export const [provideStreamPlayerLoadingConfig, injectStreamPlayerLoadingConfig] =
  createStaticRootProvider<StreamPlayerLoadingConfig>(DEFAULT_STREAM_PLAYER_LOADING_CONFIG, {
    name: 'StreamPlayerLoadingConfig',
  });
