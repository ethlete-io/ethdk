import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-auto-example',
  template: `
    <div class="example-progress-steps-auto wide">
      <et-progress-steps orientation="auto">
        <et-progress-step stepState="complete">Account</et-progress-step>
        <et-progress-step stepState="complete">Shipping</et-progress-step>
        <et-progress-step stepState="current">Payment</et-progress-step>
        <et-progress-step stepState="upcoming">Review</et-progress-step>
      </et-progress-steps>
    </div>

    <div class="example-progress-steps-auto narrow">
      <et-progress-steps orientation="auto">
        <et-progress-step stepState="complete">Account</et-progress-step>
        <et-progress-step stepState="complete">Shipping</et-progress-step>
        <et-progress-step stepState="current">Payment</et-progress-step>
        <et-progress-step stepState="upcoming">Review</et-progress-step>
      </et-progress-steps>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PROGRESS_STEPS_IMPORTS],
  styles: `
    app-progress-steps-auto-example {
      display: grid;
      gap: 24px;
    }

    .example-progress-steps-auto.wide {
      max-inline-size: 520px;
    }

    .example-progress-steps-auto.narrow {
      max-inline-size: 240px;
    }
  `,
})
export class ProgressStepsAutoExampleComponent {}
