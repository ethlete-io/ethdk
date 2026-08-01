import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { PictureConfig } from './picture.types';

const DEFAULT_PICTURE_CONFIG: PictureConfig = {
  baseUrl: undefined,
};

const PICTURE_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<PictureConfig>(DEFAULT_PICTURE_CONFIG, {
  name: 'PictureConfig',
});

/**
 * App- or route-wide picture defaults. Provide it where the media host is known — usually the app config, or
 * a route that talks to a different CDN.
 *
 * @example
 * providers: [providePictureConfig({ baseUrl: 'https://cdn.example.com' })]
 */
export const providePictureConfig = /* @__PURE__ */ toProvideFn(PICTURE_CONFIG_DEF);
export const injectPictureConfig = /* @__PURE__ */ toInjectFn(PICTURE_CONFIG_DEF);
