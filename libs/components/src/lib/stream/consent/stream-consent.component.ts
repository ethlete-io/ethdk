import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import {
  ProvideSurfaceDirective,
  injectSurfaceType,
  SURFACE_PROVIDER,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { injectStreamLabels } from '../stream-labels';
import { mountStreamOverlayCardStyles } from '../stream-overlay-card-styles.component';
import { ButtonComponent } from '../../button';
import { IconDirective, LOCK_ICON, provideIcons } from '../../icon';
import { StreamConsentAcceptDirective } from './headless/stream-consent-accept.directive';
import { StreamConsentDirective } from './headless/stream-consent.directive';
import { injectStreamConsentConfig } from './stream-consent-config';

let nextHeadingId = 0;

@Component({
  selector: 'et-stream-consent',
  template: `
    <div [etProvideSurface]="cardSurface()" class="et-stream-consent-card" etSurfaced>
      <span class="et-stream-consent-icon" etIcon="et-lock"></span>
      <h3 [id]="HEADING_ID" class="et-stream-consent-heading">{{ heading() }}</h3>
      <p class="et-stream-consent-description">{{ description() }}</p>
      <button [color]="acceptButtonColor()" et-button etStreamConsentAccept>
        {{ acceptLabel() }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [StreamConsentAcceptDirective, ButtonComponent, IconDirective, ProvideSurfaceDirective],
  providers: [provideIcons(LOCK_ICON)],
  hostDirectives: [StreamConsentDirective],
  host: {
    class: 'et-stream-consent',
    role: 'group',
    '[attr.aria-labelledby]': 'HEADING_ID',
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
    }

    .et-stream-consent-card {
      --et-stream-overlay-card-padding: var(--et-stream-consent-padding);
      --et-stream-overlay-card-gap: var(--et-stream-consent-gap);
      --et-stream-overlay-card-icon-size: var(--et-stream-consent-icon-size);
      --et-stream-overlay-card-border-radius: var(--et-stream-consent-border-radius);
      --et-stream-overlay-card-heading-size: var(--et-stream-consent-heading-size);
      --et-stream-overlay-card-heading-weight: var(--et-stream-consent-heading-weight);
      --et-stream-overlay-card-heading-line-height: var(--et-stream-consent-heading-line-height);
      --et-stream-overlay-card-heading-letter-spacing: var(--et-stream-consent-heading-letter-spacing);
      --et-stream-overlay-card-description-size: var(--et-stream-consent-description-size);
      --et-stream-overlay-card-description-weight: var(--et-stream-consent-description-weight);
      --et-stream-overlay-card-description-line-height: var(--et-stream-consent-description-line-height);
    }

    .et-stream-consent-icon {
      margin-block-end: 0.4rem;
    }

    .et-stream-consent-description {
      margin-block-end: 0.8rem;
    }
  `,
})
export class StreamConsentComponent {
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private surfaceType = injectSurfaceType();
  private config = injectStreamConsentConfig();
  private labels = injectStreamLabels();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  protected readonly HEADING_ID = `et-stream-consent-heading-${nextHeadingId++}`;

  public cardSurface = computed(() => {
    const themes = this.surfaceThemes;
    const type = this.surfaceType();
    if (!themes || !type) return null;

    const elevation = (this.parentSurfaceProvider?.elevation() ?? 0) + 1;

    return resolveSurfaceByElevation(themes, type, elevation)?.name ?? null;
  });

  public heading = computed(() => this.labels().consentHeading);
  public description = computed(() => this.labels().consentDescription);
  public acceptLabel = computed(() => this.labels().consentAccept);
  public acceptButtonColor = computed(() => this.config.acceptButtonColor);

  constructor() {
    mountStreamOverlayCardStyles();
  }
}
