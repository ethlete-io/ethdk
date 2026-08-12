import { booleanAttribute, Component, input, ViewEncapsulation } from '@angular/core';
import { ProgressStepsOrientation } from '../progress-steps.component';
import { PROGRESS_STEPS_IMPORTS } from '../progress-steps.imports';
import { ProgressStepState } from '../progress-step.component';

export type ProgressStepsStorybookStep = { label: string; state: ProgressStepState; description?: string };

@Component({
  selector: 'et-sb-progress-steps',
  template: `
    <div [style.max-inline-size.px]="480" class="p-8 font-sans">
      <et-progress-steps [orientation]="orientation()">
        @for (step of steps(); track step.label) {
          @if (asLinks()) {
            <!-- The step lives on the consumer's own element, so a real link (or a routerLink) keeps
                 working and the whole step is the target. -->
            <a [state]="step.state" href="#{{ step.label.toLowerCase() }}" et-progress-step>
              {{ step.label }}

              @if (step.description; as description) {
                <span etProgressStepDescription>{{ description }}</span>
              }
            </a>
          } @else {
            <et-progress-step [state]="step.state">
              {{ step.label }}

              @if (step.description; as description) {
                <span etProgressStepDescription>{{ description }}</span>
              }
            </et-progress-step>
          }
        }
      </et-progress-steps>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...PROGRESS_STEPS_IMPORTS],
})
export class ProgressStepsStorybookComponent {
  public orientation = input<ProgressStepsOrientation>('horizontal');
  public asLinks = input(false, { transform: booleanAttribute });

  public steps = input<ProgressStepsStorybookStep[]>([
    { label: 'Account', state: 'complete' },
    { label: 'Shipping', state: 'complete' },
    { label: 'Payment', state: 'current' },
    { label: 'Review', state: 'upcoming' },
  ]);
}
