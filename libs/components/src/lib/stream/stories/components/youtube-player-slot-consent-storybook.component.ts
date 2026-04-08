import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { StreamConsentComponent } from '../../consent/stream-consent.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player-slot-consent',
  template: ` <et-youtube-player-slot [videoId]="videoId()" class="slot-consent-player" /> `,
  imports: [StreamImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    ...provideStreamConfig({
      consentComponent: StreamConsentComponent,
      pipSlotPlaceholderComponent: PipSlotPlaceholderComponent,
    }),
  ],
  styles: `
    .slot-consent-player {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
    }
  `,
})
export class YoutubePlayerSlotConsentStorybookComponent {
  videoId = input('dQw4w9WgXcQ');
}
