import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ProvideColorDirective, mountVisuallyHidden } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { IconDirective, provideIcons } from '../icon';
import { ProgressStepDirective } from './headless/progress-step.directive';
import { PROGRESS_STATE_ICONS, injectProgressStateVisuals } from './progress-state-visuals';

/**
 * One step in an `et-progress-steps` row: a numbered marker that becomes an icon once resolved, plus
 * a label. `stepState` is yours to set per step - nothing is derived from position, so a skipped or
 * out-of-order step is exactly as easy to render as a strictly linear one.
 *
 * `complete` marks a step as done in the surrounding color theme; `success`, `warning` and `error`
 * mark it as done with an outcome and recolor the step in the app's matching semantic theme, each
 * with its own icon so the outcome does not rest on color alone. `skipped` marks a step the process
 * passed without doing it.
 *
 * Project `[etProgressStepDescription]` for a second, muted line under the label - what the step
 * covers, what it produced, why it failed:
 *
 * @example
 * <et-progress-step stepState="current">
 *   Payment
 *   <span etProgressStepDescription>Card ending 4242</span>
 * </et-progress-step>
 *
 * Project `[etProgressStepContent]` for any further content under the text, and `[etProgressStepMarker]`
 * to replace the number or icon inside the marker. For a look of your own, use the headless
 * `etProgressSteps` and `etProgressStep` directives instead.
 *
 * Write the step as a link or a button to make it interactive - the attribute selector puts the step
 * on the consumer's own element, so `routerLink`, `href` and click handlers all stay where they
 * belong, and the whole step becomes the target:
 *
 * @example
 * <a [routerLink]="['/checkout/account']" stepState="complete" et-progress-step>Account</a>
 */
@Component({
  selector: 'et-progress-step, [et-progress-step]',
  templateUrl: './progress-step.component.html',
  styleUrl: './progress-step.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  viewProviders: [provideIcons(...PROGRESS_STATE_ICONS)],
  hostDirectives: [
    { directive: ProgressStepDirective, inputs: ['stepState'] },
    ProvideColorDirective,
    FocusRingDirective,
  ],
  host: {
    class: 'et-progress-step',
  },
})
export class ProgressStepComponent {
  private step = inject(ProgressStepDirective);
  protected visuals = injectProgressStateVisuals(this.step.resolvedState);

  constructor() {
    mountVisuallyHidden();
  }
}
