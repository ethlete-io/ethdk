import { Component, InjectionToken, ViewEncapsulation, WritableSignal, inject, signal } from '@angular/core';
import { createUserConsentProvider } from '@ethlete/core';
import {
  BUTTON_IMPORTS,
  STREAM_DEFAULT_COMPONENTS,
  STREAM_IMPORTS,
  STREAM_USER_CONSENT_PROVIDER_TOKEN,
  STREAM_YOUTUBE_IMPORTS,
  StreamConsentComponent,
  provideStreamConfig,
} from '@ethlete/components';

const MEDIA_CONSENT = new InjectionToken<WritableSignal<boolean>>('MEDIA_CONSENT');

@Component({
  selector: 'app-stream-consent-provider-example',
  template: `
    <div class="example-stream-banner">
      <span>Cookie banner: media consent {{ mediaConsent() ? 'granted' : 'not granted' }}</span>
      <button (click)="mediaConsent.set(true)" et-button type="button">Accept</button>
      <button (click)="mediaConsent.set(false)" et-button type="button">Revoke</button>
    </div>

    <et-youtube-player-slot class="example-stream-player" videoId="dQw4w9WgXcQ" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS],
  providers: [
    { provide: MEDIA_CONSENT, useFactory: () => signal(false) },
    ...provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS, consentComponent: StreamConsentComponent }),
    createUserConsentProvider({
      for: STREAM_USER_CONSENT_PROVIDER_TOKEN,
      isGranted: () => inject(MEDIA_CONSENT).asReadonly(),
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
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      max-inline-size: 56rem;
      aspect-ratio: 16 / 9;
    }

    .example-stream-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: 16px;
    }
  `,
})
export class StreamConsentProviderExampleComponent {
  protected mediaConsent = inject(MEDIA_CONSENT);
}
