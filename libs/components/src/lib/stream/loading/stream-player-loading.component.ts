import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ProgressSpinnerComponent } from '@ethlete/cdk';

@Component({
  selector: 'et-stream-player-loading',
  template: ` <et-spinner diameter="35" strokeWidth="2" /> `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressSpinnerComponent],
  host: {
    class: 'et-stream-player-loading',
  },
  styles: `
    @property --et-stream-player-loading-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(0, 0, 0, 0.95);
    }

    @property --et-stream-player-loading-spinner-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
    }

    @property --et-stream-player-loading-spinner-track-color {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(255, 255, 255, 0.2);
    }

    .et-stream-player-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--et-stream-player-loading-bg);
      z-index: 1;

      .et-progress-spinner {
        --et-progress-spinner-color: var(--et-stream-player-loading-spinner-color);
        --et-progress-spinner-background: var(--et-stream-player-loading-spinner-track-color);
      }
    }
  `,
})
export class StreamPlayerLoadingComponent {}
