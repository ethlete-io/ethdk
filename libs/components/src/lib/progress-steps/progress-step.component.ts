import { Component, ViewEncapsulation, input } from '@angular/core';
import { CHECK_ICON, IconDirective, provideIcons } from '../icon';

export const PROGRESS_STEP_STATES = {
  COMPLETE: 'complete',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
} as const;

export type ProgressStepState = (typeof PROGRESS_STEP_STATES)[keyof typeof PROGRESS_STEP_STATES];

/**
 * One step in an `et-progress-steps` row: a numbered marker that becomes a checkmark once
 * `complete`, plus a label. `state` is yours to set per step - nothing is derived from position, so
 * a skipped or out-of-order step is exactly as easy to render as a strictly linear one.
 */
@Component({
  selector: 'et-progress-step',
  templateUrl: './progress-step.component.html',
  styleUrl: './progress-step.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHECK_ICON)],
  host: {
    class: 'et-progress-step',
    '[attr.data-state]': 'state()',
  },
})
export class ProgressStepComponent {
  public state = input<ProgressStepState>(PROGRESS_STEP_STATES.UPCOMING);
}
