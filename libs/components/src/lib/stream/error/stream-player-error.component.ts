import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { injectStreamLabels } from '../stream-labels';
import { mountStreamOverlayCardStyles } from '../stream-overlay-card-styles.component';
import { ButtonComponent } from '../../button';
import { IconDirective, TRIANGLE_EXCLAMATION_ICON, provideIcons } from '../../icon';
import { STREAM_PLAYER_ERROR_TOKEN, StreamPlayerErrorDirective } from './headless/stream-player-error.directive';
import { injectStreamPlayerErrorConfig } from './stream-player-error-config';

@Component({
  selector: 'et-stream-player-error',
  template: `
    <div class="et-stream-player-error-card">
      <span class="et-stream-player-error-icon" etIcon="et-triangle-exclamation"></span>
      <p class="et-stream-player-error-heading">{{ heading() }}</p>
      <p class="et-stream-player-error-description">{{ description() }}</p>
      <button [color]="retryButtonColor()" (click)="retry()" et-button type="button">
        {{ retryLabel() }}
      </button>
    </div>
  `,
  styleUrl: './stream-player-error.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent, IconDirective],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [StreamPlayerErrorDirective],
  host: {
    class: 'et-stream-player-error',
    role: 'alert',
  },
})
export class StreamPlayerErrorComponent {
  private errorDirective = inject(STREAM_PLAYER_ERROR_TOKEN);
  private config = injectStreamPlayerErrorConfig();
  private labels = injectStreamLabels();

  public heading = computed(() => this.labels().errorHeading);
  public description = computed(() => this.labels().errorDescription);
  public retryLabel = computed(() => this.labels().errorRetry);
  public retryButtonColor = computed(() => this.config.retryButtonColor);

  constructor() {
    mountStreamOverlayCardStyles();
  }

  public retry() {
    this.errorDirective.context.retry();
  }
}
