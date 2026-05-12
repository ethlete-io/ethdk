import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { StreamConsentComponent } from '../../consent/stream-consent.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player-slot-consent',
  template: ` <et-youtube-player-slot [videoId]="videoId()" class="block w-full aspect-video" /> `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports],
  providers: [
    ...provideStreamConfig({
      consentComponent: StreamConsentComponent,
      pipSlotPlaceholderComponent: PipSlotPlaceholderComponent,
      pipChrome: { controlsColor: 'neutral' },
    }),
  ],
})
export class YoutubePlayerSlotConsentStorybookComponent {
  videoId = input('dQw4w9WgXcQ');
}
