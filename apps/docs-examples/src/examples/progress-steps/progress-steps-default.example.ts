import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-default-example',
  template: `
    <et-progress-steps>
      <et-progress-step stepState="complete">Account</et-progress-step>
      <et-progress-step stepState="complete">Shipping</et-progress-step>
      <et-progress-step stepState="current">Payment</et-progress-step>
      <et-progress-step stepState="upcoming">Review</et-progress-step>
    </et-progress-steps>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PROGRESS_STEPS_IMPORTS],
  styles: `
    app-progress-steps-default-example {
      max-inline-size: 480px;
    }
  `,
})
export class ProgressStepsDefaultExampleComponent {}
