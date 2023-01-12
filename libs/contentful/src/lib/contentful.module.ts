import { NgModule } from '@angular/core';
import {
  ContentfulAudioComponent,
  ContentfulFileComponent,
  ContentfulImageComponent,
  ContentfulRichTextRendererComponent,
  ContentfulVideoComponent,
} from './public-api';

@NgModule({
  imports: [
    ContentfulAudioComponent,
    ContentfulFileComponent,
    ContentfulImageComponent,
    ContentfulVideoComponent,
    ContentfulRichTextRendererComponent,
  ],
  exports: [
    ContentfulAudioComponent,
    ContentfulFileComponent,
    ContentfulImageComponent,
    ContentfulVideoComponent,
    ContentfulRichTextRendererComponent,
  ],
})
export class ContentfulModule {}
