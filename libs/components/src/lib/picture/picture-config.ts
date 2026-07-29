import { createStaticRootProvider } from '@ethlete/core';
import { PictureConfig } from './picture.types';

const DEFAULT_PICTURE_CONFIG: PictureConfig = {
  baseUrl: undefined,
};

/**
 * App- or route-wide picture defaults. Provide it where the media host is known — usually the app config, or
 * a route that talks to a different CDN.
 *
 * @example
 * providers: [providePictureConfig({ baseUrl: 'https://cdn.example.com' })]
 */
export const [providePictureConfig, injectPictureConfig] = createStaticRootProvider<PictureConfig>(
  DEFAULT_PICTURE_CONFIG,
  { name: 'PictureConfig' },
);
