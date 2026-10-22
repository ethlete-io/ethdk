import { Component, ViewEncapsulation } from '@angular/core';
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-progress-steps-outcomes-example',
  template: `
    <et-progress-steps>
      <et-progress-step state="success">Upload</et-progress-step>
      <et-progress-step state="warning">Validate</et-progress-step>
      <et-progress-step state="error">Import</et-progress-step>
      <et-progress-step state="upcoming">Publish</et-progress-step>
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
