import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { createUserConsentProvider } from '@ethlete/core';
import { STREAM_USER_CONSENT_PROVIDER_TOKEN } from '../../consent';
import { StreamImports } from '../../stream.imports';

const _consentGranted = signal(localStorage.getItem('stream-consent') === 'granted');

@Component({
  selector: 'et-sb-youtube-player-consent',
  template: `
    <et-stream-consent>
      <ng-template etStreamConsentContent>
        <et-youtube-player [videoId]="videoId()" [width]="width()" [height]="height()" />
      </ng-template>
      <ng-template etStreamConsentPlaceholder>
        <div class="sb-placeholder">
          <p>This video is hosted on YouTube.</p>
          <button etStreamConsentAccept>Load video</button>
        </div>
      </ng-template>
    </et-stream-consent>
  `,
  imports: [StreamImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    createUserConsentProvider({
      for: STREAM_USER_CONSENT_PROVIDER_TOKEN,
      isGranted: () => computed(() => _consentGranted()),
      grant: () => {
        return () => {
          localStorage.setItem('stream-consent', 'granted');
          _consentGranted.set(true);
        };
      },
      revoke: () => () => {
        localStorage.removeItem('stream-consent');
        _consentGranted.set(false);
      },
    }),
  ],
  styles: `
    .sb-placeholder {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      padding: 24px;
      background: #0a0a0a;
      border-radius: 4px;
    }
  `,
})
export class YoutubePlayerConsentStorybookComponent {
  videoId = input('dQw4w9WgXcQ');
  width = input<string | number>('100%');
  height = input<string | number>(360);
}
