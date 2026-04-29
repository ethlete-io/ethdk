import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { STREAM_PLAYER_ERROR_TOKEN, StreamPlayerErrorDirective } from './headless/stream-player-error.directive';

@Component({
  selector: 'et-stream-player-error',
  template: `
    <p class="et-stream-player-error-message">{{ errorMessage() }}</p>
    <button (click)="retry()" class="et-stream-player-error-retry" type="button">Retry</button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [StreamPlayerErrorDirective],
  host: {
    class: 'et-stream-player-error',
  },
  styles: `
    @property --et-stream-player-error-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(0, 0, 0, 0.6);
    }

    @property --et-stream-player-error-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
    }

    @property --et-stream-player-error-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    @property --et-stream-player-error-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-stream-player-error-retry-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: transparent;
    }

    @property --et-stream-player-error-retry-border-color {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(255, 255, 255, 0.5);
    }

    @property --et-stream-player-error-retry-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
    }

    .et-stream-player-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--et-stream-player-error-gap);
      background: var(--et-stream-player-error-bg);
      color: var(--et-stream-player-error-color);
      font-family: sans-serif;
      text-align: center;
      z-index: 1;

      .et-stream-player-error-message {
        margin: 0;
        font-size: 14px;
        padding: 0 var(--et-stream-player-error-padding);
      }

      .et-stream-player-error-retry {
        padding: 6px 16px;
        background: var(--et-stream-player-error-retry-bg);
        color: var(--et-stream-player-error-retry-color);
        border: 1px solid var(--et-stream-player-error-retry-border-color);
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
      }
    }
  `,
})
export class StreamPlayerErrorComponent {
  private errorDirective = inject(STREAM_PLAYER_ERROR_TOKEN);

  errorMessage = computed(() => {
    const err = this.errorDirective.context.error();
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Failed to load player.';
  });

  retry() {
    this.errorDirective.context.retry();
  }
}
