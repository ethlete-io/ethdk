import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { injectUrl } from '@ethlete/core';
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
            <a
              [state]="linkState($index)"
              [routerLink]="['/', step.label.toLowerCase()]"
              etProgressStepRouterActive
              et-progress-step
            >
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

      @if (asLinks()) {
        <div class="mt-8">
          <router-outlet />
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...PROGRESS_STEPS_IMPORTS, RouterLink, RouterOutlet],
})
export class ProgressStepsStorybookComponent {
  private url = injectUrl();

  public orientation = input<ProgressStepsOrientation>('horizontal');
  public asLinks = input(false, { transform: booleanAttribute });

  public steps = input<ProgressStepsStorybookStep[]>([
    { label: 'Account', state: 'complete' },
    { label: 'Shipping', state: 'complete' },
    { label: 'Payment', state: 'current' },
    { label: 'Review', state: 'upcoming' },
  ]);

  private activeIndex = computed(() => {
    const segment = this.url().split(/[?#]/)[0]?.split('/')[1] ?? '';
    const index = this.steps().findIndex((step) => step.label.toLowerCase() === segment);

    return index === -1 ? 0 : index;
  });

  protected linkState(index: number): ProgressStepState {
    const active = this.activeIndex();

    return index < active ? 'complete' : 'upcoming';
  }
}
