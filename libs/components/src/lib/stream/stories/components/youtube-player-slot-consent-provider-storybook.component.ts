import { Component, InjectionToken, ViewEncapsulation, WritableSignal, inject, input, signal } from '@angular/core';
import { createUserConsentProvider } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { StreamConsentComponent } from '../../consent/stream-consent.component';
import { STREAM_USER_CONSENT_PROVIDER_TOKEN } from '../../consent/headless/stream-consent.directive';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';

const MEDIA_CONSENT = new InjectionToken<WritableSignal<boolean>>('MEDIA_CONSENT');

@Component({
  selector: 'et-sb-youtube-player-slot-consent-provider',
  template: `
    <div class="flex flex-col gap-4 p-8">
      <div class="flex flex-wrap items-center gap-2">
        <span>Cookie banner: media consent {{ mediaConsent() ? 'granted' : 'not granted' }}</span>
        <button (click)="mediaConsent.set(true)" et-button type="button">Accept</button>
        <button (click)="mediaConsent.set(false)" et-button type="button">Revoke</button>
      </div>

      <et-youtube-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS],
  providers: [
    { provide: MEDIA_CONSENT, useFactory: () => signal(false) },
    ...provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS, consentComponent: StreamConsentComponent }),
    createUserConsentProvider({
      for: STREAM_USER_CONSENT_PROVIDER_TOKEN,
      isGranted: () => {
        const mediaConsent = inject(MEDIA_CONSENT);

        return mediaConsent.asReadonly();
      },
      grant: () => {
        const mediaConsent = inject(MEDIA_CONSENT);

        return () => mediaConsent.set(true);
      },
      revoke: () => {
        const mediaConsent = inject(MEDIA_CONSENT);

        return () => mediaConsent.set(false);
      },
    }),
  ],
})
export class YoutubePlayerSlotConsentProviderStorybookComponent {
  protected mediaConsent = inject(MEDIA_CONSENT);

  public videoId = input('dQw4w9WgXcQ');
}
