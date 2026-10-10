import { inject } from '@angular/core';
import { CONTENTFUL_CONFIG } from '../constants/contentful.constants';
import { ContentfulConfig, ContentfulConfigOptions } from '../types';

/**
 * The config used when no `provideContentfulConfig()` is in scope. It declares no
 * `components`, so embedded assets are skipped and hyperlinks render as plain anchors
 * until a config is provided.
 */
const CONTENTFUL_FALLBACK_CONFIG: ContentfulConfig = {
  internalHosts: [],
  entryHref: null,
  components: {},
  customComponents: {},
  imageOptions: {
    srcsetSizes: ['375w', '1280w', '1920w', '2560w'],
    sizes: ['100vw'],
    backgroundColor: null,
  },
};

const withoutUndefined = <T extends object>(value: T | null | undefined) =>
  Object.fromEntries(Object.entries(value ?? {}).filter(([, entry]) => entry !== undefined)) as Partial<T>;

export const createContentfulConfig = (options?: ContentfulConfigOptions | null): ContentfulConfig => {
  const config = options ?? {};

  return {
    ...CONTENTFUL_FALLBACK_CONFIG,
    ...config,
    components: config.components ?? CONTENTFUL_FALLBACK_CONFIG.components,
    customComponents: config.customComponents ?? CONTENTFUL_FALLBACK_CONFIG.customComponents,
    internalHosts: config.internalHosts ?? CONTENTFUL_FALLBACK_CONFIG.internalHosts,
    imageOptions: { ...CONTENTFUL_FALLBACK_CONFIG.imageOptions, ...withoutUndefined(config.imageOptions) },
  };
};

/**
 * Reads the contentful config from the current injector. Falls back to a config without
 * any `components` when none was provided via `provideContentfulConfig()`.
 */
export const injectContentfulConfig = (): ContentfulConfig =>
  inject(CONTENTFUL_CONFIG, { optional: true }) ?? CONTENTFUL_FALLBACK_CONFIG;
