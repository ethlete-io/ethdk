import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-default-example',
  template: `
    <et-progress-steps>
      <et-progress-step state="complete">Account</et-progress-step>
      <et-progress-step state="complete">Shipping</et-progress-step>
      <et-progress-step state="current">Payment</et-progress-step>
      <et-progress-step state="upcoming">Review</et-progress-step>
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
