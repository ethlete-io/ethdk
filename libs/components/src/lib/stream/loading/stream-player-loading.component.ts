import { Component, ViewEncapsulation } from '@angular/core';
import { SpinnerComponent } from '../../loader';
import { injectStreamLabels } from '../stream-labels';
import { injectStreamPlayerLoadingConfig } from './stream-player-loading-config';

@Component({
  selector: 'et-stream-player-loading',
  template: ` <et-spinner [diameter]="config.spinnerDiameter" [strokeWidth]="config.spinnerStrokeWidth" track /> `,
  styleUrl: './stream-player-loading.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
  host: {
    class: 'et-stream-player-loading',
    role: 'status',
    '[attr.aria-label]': 'labels().loading',
  },
})
export class StreamPlayerLoadingComponent {
  protected labels = injectStreamLabels();

  protected config = injectStreamPlayerLoadingConfig();
}
