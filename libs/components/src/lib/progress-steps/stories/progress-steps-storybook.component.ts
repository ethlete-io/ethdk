import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '../progress-steps.imports';

@Component({
  selector: 'et-sb-progress-steps',
  template: `
    <div [style.max-inline-size.px]="480" class="p-8 font-sans">
      <et-progress-steps>
        <et-progress-step state="complete">Account</et-progress-step>
        <et-progress-step state="complete">Shipping</et-progress-step>
        <et-progress-step state="current">Payment</et-progress-step>
        <et-progress-step state="upcoming">Review</et-progress-step>
      </et-progress-steps>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...PROGRESS_STEPS_IMPORTS],
})
export class ProgressStepsStorybookComponent {}
