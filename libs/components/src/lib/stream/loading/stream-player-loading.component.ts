import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { SpinnerComponent } from '../../loader';
import { injectStreamPlayerLoadingConfig } from './stream-player-loading-config';

@Component({
  selector: 'et-stream-player-loading',
  template: ` <et-spinner [diameter]="config.spinnerDiameter" [strokeWidth]="config.spinnerStrokeWidth" track /> `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  host: {
    class: 'et-stream-player-loading',
  },
  styles: `
    .et-stream-player-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--et-surface-background-solid, inherit);
      color: var(--et-surface-color-solid, inherit);
      z-index: 1;

      .et-spinner {
        --et-spinner-color: var(--et-surface-color-muted-solid, currentColor);
        --et-spinner-track-color: var(--et-surface-color-subtle-solid, currentColor);
      }
    }
  `,
})
export class StreamPlayerLoadingComponent {
  protected config = injectStreamPlayerLoadingConfig();
}
