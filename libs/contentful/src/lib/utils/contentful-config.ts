import { ContentfulAudioComponent } from '../components/audio';
import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulVideoComponent } from '../components/video';
import { ContentfulConfig } from '../types';

export const createContentfulConfig = (
  config: Partial<ContentfulConfig> | null | undefined = {},
): ContentfulConfig => ({
  // This default config must be inline and not saved inside a const for some weird webpack reason
  ...{
    useTailwindClasses: false,
    components: {
      audio: ContentfulAudioComponent,
      file: ContentfulFileComponent,
      image: ContentfulImageComponent,
      video: ContentfulVideoComponent,
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
