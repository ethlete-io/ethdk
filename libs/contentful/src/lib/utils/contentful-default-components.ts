import { ContentfulAudioComponent } from '../components/audio';
import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { ContentfulVideoComponent } from '../components/video';
import { ContentfulConfig } from '../types';

/**
 * The shipped audio, file, image, video and link components, to spread into `provideContentfulConfig`.
 * An app that brings its own components, or renders text only, leaves this out and bundles none of them.
 * To replace one, spread the map instead: `components: { ...CONTENTFUL_DEFAULT_COMPONENTS.components, image: MyImage }`.
 *
 * @example
 * provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });
 */
export const CONTENTFUL_DEFAULT_COMPONENTS = {
  components: {
    audio: ContentfulAudioComponent,
    file: ContentfulFileComponent,
    image: ContentfulImageComponent,
    video: ContentfulVideoComponent,
    link: ContentfulLinkComponent,
  },
} satisfies Partial<ContentfulConfig>;
