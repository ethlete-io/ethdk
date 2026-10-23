import { Component, InjectionToken, ViewEncapsulation, WritableSignal, inject, signal } from '@angular/core';
import { createUserConsentProvider } from '@ethlete/core';
import {
  BADGE_IMPORTS,
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
    <div class="example-stream-consent">
      <span class="example-stream-consent-label">
        Media consent
        <et-badge [color]="mediaConsent() ? 'success' : 'warning'" size="sm">
          {{ mediaConsent() ? 'Granted' : 'Not granted' }}
        </et-badge>
      </span>
      <div class="app-example-row">
        <button [disabled]="mediaConsent()" (click)="mediaConsent.set(true)" et-button size="sm" type="button">
          Accept
        </button>
        <button [disabled]="!mediaConsent()" (click)="mediaConsent.set(false)" et-button size="sm" type="button">
          Revoke
        </button>
      </div>
    </div>

    <et-youtube-player-slot class="example-stream-player" videoId="dQw4w9WgXcQ" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS, BADGE_IMPORTS],
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
      aspect-ratio: 16 / 9;
    }

    .example-stream-consent {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem 1.6rem;
    }

    .example-stream-consent-label {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
    }

    .example-stream-consent-label > .et-badge {
      align-self: center;
    }
  `,
})
export class StreamConsentProviderExampleComponent {
  protected mediaConsent = inject(MEDIA_CONSENT);
}
