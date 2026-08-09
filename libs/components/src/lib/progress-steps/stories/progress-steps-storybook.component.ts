import { Component, input, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '../progress-steps.imports';
import { ProgressStepState } from '../progress-step.component';

export type ProgressStepsStorybookStep = { label: string; state: ProgressStepState };

@Component({
  selector: 'et-sb-progress-steps',
  template: `
    <div [style.max-inline-size.px]="480" class="p-8 font-sans">
      <et-progress-steps>
        @for (step of steps(); track step.label) {
          <et-progress-step [state]="step.state">{{ step.label }}</et-progress-step>
        }
      </et-progress-steps>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...PROGRESS_STEPS_IMPORTS],
})
export class ProgressStepsStorybookComponent {
  public steps = input<ProgressStepsStorybookStep[]>([
    { label: 'Account', state: 'complete' },
    { label: 'Shipping', state: 'complete' },
    { label: 'Payment', state: 'current' },
    { label: 'Review', state: 'upcoming' },
  ]);
}
