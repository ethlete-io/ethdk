import { ContentfulAudioComponent } from './components/audio';
import { ContentfulFileComponent } from './components/file';
import { ContentfulImageComponent } from './components/image';
import { ContentfulRichTextRendererComponent } from './components/rich-text-renderer';
import { ContentfulVideoComponent } from './components/video';

export const ContentfulImports = [
  ContentfulAudioComponent,
  ContentfulFileComponent,
  ContentfulImageComponent,
  ContentfulVideoComponent,
  ContentfulRichTextRendererComponent,
] as const;
