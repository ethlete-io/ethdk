import { Component, ViewEncapsulation, input } from '@angular/core';
import { StreamConsentComponent } from '../../consent/stream-consent.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_IMPORTS, STREAM_PIP_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player-slot-consent',
  template: ` <et-youtube-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" /> `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, STREAM_PIP_IMPORTS],
  providers: [
    ...provideStreamConfig({
      consentComponent: StreamConsentComponent,
      pipSlotPlaceholderComponent: PipSlotPlaceholderComponent,
      pipChrome: { controlsColor: 'neutral' },
    }),
  ],
})
export class YoutubePlayerSlotConsentStorybookComponent {
  public videoId = input('dQw4w9WgXcQ');
}
