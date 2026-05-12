import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed } from '@angular/core';
import {
  ProvideSurfaceDirective,
  SurfacedDirective,
  injectLocale,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { ButtonComponent } from '../../button';
import { IconDirective, LOCK_ICON, provideIcons } from '../../icon';
import { StreamConsentAcceptDirective } from './headless/stream-consent-accept.directive';
import { StreamConsentDirective } from './headless/stream-consent.directive';
import { injectStreamConsentConfig } from './stream-consent-config';

@Component({
  selector: 'et-stream-consent',
  template: `
    <div [etProvideSurface]="cardSurface()" class="et-stream-consent-card" etSurfaced>
      <span class="et-stream-consent-icon" etIcon="et-lock"></span>
      <h3 class="et-stream-consent-heading">{{ heading() }}</h3>
      <p class="et-stream-consent-description">{{ description() }}</p>
      <button [color]="acceptButtonColor()" et-button etStreamConsentAccept>
        {{ acceptLabel() }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamConsentAcceptDirective, ButtonComponent, IconDirective, ProvideSurfaceDirective, SurfacedDirective],
  providers: [provideIcons(LOCK_ICON)],
  hostDirectives: [StreamConsentDirective],
  host: {
    class: 'et-stream-consent',
  },
  styles: `
    @property --et-stream-consent-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 32px;
    }

    @property --et-stream-consent-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    @property --et-stream-consent-icon-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 36px;
    }

    @property --et-stream-consent-border-radius {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-consent-heading-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-consent-heading-weight {
      syntax: '<number>';
      inherits: false;
      initial-value: 600;
    }

    @property --et-stream-consent-heading-line-height {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 122%;
    }

    @property --et-stream-consent-heading-letter-spacing {
      syntax: '<length>';
      inherits: false;
      initial-value: 0.2px;
    }

    @property --et-stream-consent-description-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 14px;
    }

    @property --et-stream-consent-description-weight {
      syntax: '<number>';
      inherits: false;
      initial-value: 400;
    }

    @property --et-stream-consent-description-line-height {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 150%;
    }

    .et-stream-consent {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: var(--et-surface-background-solid, inherit);
      color: var(--et-surface-color-solid, inherit);

      .et-stream-consent-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--et-stream-consent-gap);
        padding: var(--et-stream-consent-padding);
        border-radius: var(--et-stream-consent-border-radius);
        max-width: 36rem;
        text-align: center;
        background: var(--et-surface-background-solid, inherit);
      }

      .et-stream-consent-icon {
        width: var(--et-stream-consent-icon-size);
        height: var(--et-stream-consent-icon-size);
        color: var(--et-surface-color-subtle-solid, currentColor);
        margin-block-end: 0.4rem;
      }

      .et-stream-consent-heading {
        margin: 0;
        font-size: var(--et-stream-consent-heading-size);
        font-weight: var(--et-stream-consent-heading-weight);
        line-height: var(--et-stream-consent-heading-line-height);
        letter-spacing: var(--et-stream-consent-heading-letter-spacing);
        color: var(--et-surface-color-solid, currentColor);
      }

      .et-stream-consent-description {
        margin: 0;
        font-size: var(--et-stream-consent-description-size);
        font-weight: var(--et-stream-consent-description-weight);
        line-height: var(--et-stream-consent-description-line-height);
        color: var(--et-surface-color-muted-solid, currentColor);
        margin-block-end: 0.8rem;
      }
    }
  `,
})
export class StreamConsentComponent {
  private config = injectStreamConsentConfig();
  private locale = injectLocale();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();

  cardSurface = computed(() => {
    const themes = this.surfaceThemes;
    if (!themes) return null;

    const type = this.surfaceContextTracker.topType() ?? 'dark';
    const elevation = this.surfaceContextTracker.topElevation() + 1;

    return resolveSurfaceByElevation(themes, type, elevation)?.name ?? null;
  });

  heading = computed(() => this.config.transformer(this.config.heading, this.locale.currentLocale()));
  description = computed(() => this.config.transformer(this.config.description, this.locale.currentLocale()));
  acceptLabel = computed(() => this.config.transformer(this.config.acceptLabel, this.locale.currentLocale()));
  acceptButtonColor = computed(() => this.config.acceptButtonColor);
}
