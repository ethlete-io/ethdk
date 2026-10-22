import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-vertical-descriptions-example',
  template: `
    <et-progress-steps orientation="vertical">
      <et-progress-step state="complete">
        Account
        <span etProgressStepDescription>sam@example.com</span>
      </et-progress-step>
      <et-progress-step state="complete">
        Shipping
        <span etProgressStepDescription>Standard, 2-4 days</span>
      </et-progress-step>
      <et-progress-step state="current">
        Payment
        <span etProgressStepDescription>Card ending 4242</span>
      </et-progress-step>
      <et-progress-step state="upcoming">
        Review
        <span etProgressStepDescription>Confirm and place the order</span>
      </et-progress-step>
    </et-progress-steps>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PROGRESS_STEPS_IMPORTS],
  styles: `
    app-progress-steps-vertical-descriptions-example {
      max-inline-size: 480px;
    }
  `,
})
export class ProgressStepsVerticalDescriptionsExampleComponent {}
