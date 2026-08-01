import { inject } from '@angular/core';
import { ContentfulAudioComponent } from '../components/audio';
import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { ContentfulVideoComponent } from '../components/video';
import { CONTENTFUL_CONFIG } from '../constants/contentful.constants';
import { ContentfulConfig } from '../types';

/**
 * The config used when no `provideContentfulConfig()` is in scope. It declares no
 * `components`, so embedded assets are skipped and hyperlinks render as plain anchors
 * until a config is provided.
 */
const CONTENTFUL_FALLBACK_CONFIG: ContentfulConfig = {
  internalHosts: [],
  components: {},
  customComponents: {},
  imageOptions: {
    srcsetSizes: ['375w', '1280w', '1920w', '2560w'],
    sizes: [],
    backgroundColor: null,
  },
};

export const createContentfulConfig = (
  config: Partial<ContentfulConfig> | null | undefined = {},
): ContentfulConfig => ({
  // This default config must be inline and not saved inside a const for some weird webpack reason
  ...{
    internalHosts: [],
    components: {
      audio: ContentfulAudioComponent,
      file: ContentfulFileComponent,
      image: ContentfulImageComponent,
      video: ContentfulVideoComponent,
      link: ContentfulLinkComponent,
    },
    customComponents: {},
    imageOptions: {
      srcsetSizes: ['375w', '1280w', '1920w', '2560w'],
      sizes: [],
      backgroundColor: null,
    },
  },
  ...(config || {}),
});

/**
 * Reads the contentful config from the current injector. Falls back to a config without
 * any `components` when none was provided via `provideContentfulConfig()`.
 */
export const injectContentfulConfig = (): ContentfulConfig =>
  inject(CONTENTFUL_CONFIG, { optional: true }) ?? CONTENTFUL_FALLBACK_CONFIG;
