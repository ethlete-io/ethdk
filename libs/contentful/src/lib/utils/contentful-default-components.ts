import { ContentfulAudioComponent } from '../components/audio';
import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { ContentfulVideoComponent } from '../components/video';
import { ContentfulConfigFeature } from '../types';

/**
 * Registers the shipped audio, file, image, video and link components for embedded assets and
 * hyperlinks. An app that brings its own components, or renders text only, leaves this out and
 * bundles none of them. A component named in `components` still wins.
 *
 * @example
 * provideContentfulConfig({ features: [withContentfulDefaultComponents()] });
 */
export const withContentfulDefaultComponents = (): ContentfulConfigFeature => ({
  type: 'default-components',
  components: {
    audio: ContentfulAudioComponent,
    file: ContentfulFileComponent,
    image: ContentfulImageComponent,
    video: ContentfulVideoComponent,
    link: ContentfulLinkComponent,
  },
});
