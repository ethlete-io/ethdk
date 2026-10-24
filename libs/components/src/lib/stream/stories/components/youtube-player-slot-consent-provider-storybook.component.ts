import { Component, InjectionToken, ViewEncapsulation, WritableSignal, inject, input, signal } from '@angular/core';
import { AutoSurfaceDirective, createUserConsentProvider } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { CIRCLE_CHECK_ICON, EYE_SLASH_ICON, ICON_IMPORTS, provideIcons } from '../../../icon';
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
      <div [class.et-sb-cookie-bar--granted]="mediaConsent()" class="et-sb-cookie-bar" etAutoSurface>
        <span class="et-sb-cookie-bar__badge">
          @if (mediaConsent()) {
            <i etIcon="et-circle-check"></i>
          } @else {
            <i etIcon="et-eye-slash"></i>
          }
        </span>
        <div class="et-sb-cookie-bar__text">
          <p class="et-sb-cookie-bar__title">Cookie banner</p>
          <p class="et-sb-cookie-bar__status">
            Embedded media {{ mediaConsent() ? 'allowed' : 'blocked until you allow it' }}
          </p>
        </div>
        @if (mediaConsent()) {
          <button (click)="mediaConsent.set(false)" et-button variant="outline" size="sm" type="button">Revoke</button>
        } @else {
          <button (click)="mediaConsent.set(true)" et-button size="sm" type="button">Allow media</button>
        }
      </div>

      <et-youtube-player-slot [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, BUTTON_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [
    provideIcons(CIRCLE_CHECK_ICON, EYE_SLASH_ICON),
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
  styles: `
    .et-sb-cookie-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 560px;
      padding: 10px 12px 10px 10px;
      border: 1px solid var(--et-surface-border-solid, rgb(255 255 255 / 0.1));
      border-radius: 14px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }

    .et-sb-cookie-bar__badge {
      display: grid;
      place-items: center;
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 8%, transparent);
      color: var(--et-surface-color-muted-solid, currentColor);
      font-size: 18px;
    }

    .et-sb-cookie-bar--granted .et-sb-cookie-bar__badge {
      background: color-mix(in srgb, var(--et-theme-color-primary-solid) 18%, transparent);
      color: var(--et-theme-color-ink-solid, currentColor);
    }

    .et-sb-cookie-bar__badge i {
      width: 18px;
      height: 18px;
    }

    .et-sb-cookie-bar__text {
      flex: 1;
      min-width: 0;
    }

    .et-sb-cookie-bar__title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
    }

    .et-sb-cookie-bar__status {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--et-surface-color-muted-solid, currentColor);
    }
  `,
})
export class YoutubePlayerSlotConsentProviderStorybookComponent {
  protected mediaConsent = inject(MEDIA_CONSENT);

  public videoId = input('dQw4w9WgXcQ');
}
