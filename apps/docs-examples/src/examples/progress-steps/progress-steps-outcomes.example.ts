import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-outcomes-example',
  template: `
    <et-progress-steps>
      <et-progress-step stepState="success">Upload</et-progress-step>
      <et-progress-step stepState="warning">Validate</et-progress-step>
      <et-progress-step stepState="error">Import</et-progress-step>
      <et-progress-step stepState="upcoming">Publish</et-progress-step>
    </et-progress-steps>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PROGRESS_STEPS_IMPORTS],
  styles: `
    app-progress-steps-outcomes-example {
      max-inline-size: 480px;
    }
  `,
})
export class ProgressStepsOutcomesExampleComponent {}
