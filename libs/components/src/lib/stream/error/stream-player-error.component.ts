import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import {
  ProvideSurfaceDirective,
  SurfacedDirective,
  injectLocale,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { ButtonComponent } from '../../button';
import { IconDirective, TRIANGLE_EXCLAMATION_ICON, provideIcons } from '../../icon';
import { STREAM_PLAYER_ERROR_TOKEN, StreamPlayerErrorDirective } from './headless/stream-player-error.directive';
import { injectStreamPlayerErrorConfig } from './stream-player-error-config';

@Component({
  selector: 'et-stream-player-error',
  template: `
    <div [etProvideSurface]="cardSurface()" class="et-stream-player-error-card" etSurfaced>
      <span class="et-stream-player-error-icon" etIcon="et-triangle-exclamation"></span>
      <h3 class="et-stream-player-error-heading">{{ heading() }}</h3>
      <p class="et-stream-player-error-description">{{ description() }}</p>
      <button [color]="retryButtonColor()" (click)="retry()" et-button type="button">
        {{ retryLabel() }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconDirective, ProvideSurfaceDirective, SurfacedDirective],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [StreamPlayerErrorDirective],
  host: {
    class: 'et-stream-player-error',
  },
  styles: `
    @property --et-stream-player-error-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    @property --et-stream-player-error-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 32px;
    }

    @property --et-stream-player-error-icon-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 36px;
    }

    @property --et-stream-player-error-border-radius {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-player-error-heading-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-player-error-heading-weight {
      syntax: '<number>';
      inherits: false;
      initial-value: 600;
    }

    @property --et-stream-player-error-heading-line-height {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 122%;
    }

    @property --et-stream-player-error-heading-letter-spacing {
      syntax: '<length>';
      inherits: false;
      initial-value: 0.2px;
    }

    @property --et-stream-player-error-description-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 14px;
    }

    @property --et-stream-player-error-description-weight {
      syntax: '<number>';
      inherits: false;
      initial-value: 400;
    }

    @property --et-stream-player-error-description-line-height {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 150%;
    }

    .et-stream-player-error {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--et-surface-background-solid, inherit);
      color: var(--et-surface-color-solid, inherit);
      z-index: 1;

      .et-stream-player-error-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--et-stream-player-error-gap);
        padding: var(--et-stream-player-error-padding);
        border-radius: var(--et-stream-player-error-border-radius);
        max-width: 36rem;
        text-align: center;
        background: var(--et-surface-background-solid, inherit);
      }

      .et-stream-player-error-icon {
        width: var(--et-stream-player-error-icon-size);
        height: var(--et-stream-player-error-icon-size);
        color: var(--et-surface-color-subtle-solid, currentColor);
        margin-block-end: 0.4rem;
      }

      .et-stream-player-error-heading {
        margin: 0;
        font-size: var(--et-stream-player-error-heading-size);
        font-weight: var(--et-stream-player-error-heading-weight);
        line-height: var(--et-stream-player-error-heading-line-height);
        letter-spacing: var(--et-stream-player-error-heading-letter-spacing);
        color: var(--et-surface-color-solid, currentColor);
      }

      .et-stream-player-error-description {
        margin: 0;
        font-size: var(--et-stream-player-error-description-size);
        font-weight: var(--et-stream-player-error-description-weight);
        line-height: var(--et-stream-player-error-description-line-height);
        color: var(--et-surface-color-muted-solid, currentColor);
        margin-block-end: 0.8rem;
      }
    }
  `,
})
export class StreamPlayerErrorComponent {
  private errorDirective = inject(STREAM_PLAYER_ERROR_TOKEN);
  private config = injectStreamPlayerErrorConfig();
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
  retryLabel = computed(() => this.config.transformer(this.config.retryLabel, this.locale.currentLocale()));
  retryButtonColor = computed(() => this.config.retryButtonColor);

  retry() {
    this.errorDirective.context.retry();
  }
}
