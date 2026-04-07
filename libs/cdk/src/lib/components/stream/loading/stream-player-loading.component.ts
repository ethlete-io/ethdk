import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ProgressSpinnerComponent } from '../../progress-spinner';

@Component({
  selector: 'et-stream-player-loading',
  template: ` <et-spinner diameter="35" strokeWidth="2" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-stream-player-loading',
  },
  imports: [ProgressSpinnerComponent],
  styles: `
    @property --et-stream-player-loading-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(0, 0, 0, 0.95);
    }

    .et-stream-player-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--et-stream-player-loading-bg);
      z-index: 1;
    }
  `,
})
export class StreamPlayerLoadingComponent {}
