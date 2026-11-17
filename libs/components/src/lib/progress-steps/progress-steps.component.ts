import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProgressStepsDirective } from './headless/progress-steps.directive';

export const PROGRESS_STEPS_ALIGNS = {
  CENTER: 'center',
  START: 'start',
} as const;

export type ProgressStepsAlign = (typeof PROGRESS_STEPS_ALIGNS)[keyof typeof PROGRESS_STEPS_ALIGNS];

/**
 * Lays out a row - or a column - of `et-progress-step`s with automatic step numbering and a connecting line
 * between them. Project the steps in order, each with its own `stepState`. The default `orientation="auto"`
 * stacks the steps into a column once the row gets too narrow for them, so they never scroll sideways.
 *
 * @example
 * <et-progress-steps>
 *   <et-progress-step stepState="complete">Account</et-progress-step>
 *   <et-progress-step stepState="current">Shipping</et-progress-step>
 *   <et-progress-step stepState="upcoming">Payment</et-progress-step>
 * </et-progress-steps>
 */
@Component({
  selector: 'et-progress-steps',
  template: `<ng-content />`,
  styleUrl: './progress-steps.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: ProgressStepsDirective, inputs: ['orientation', 'minStepSize'] }],
  host: {
    class: 'et-progress-steps',
    '[attr.data-align]': 'align()',
  },
})
export class ProgressStepsComponent {
  /** In a row, whether each step's marker, label and description center in the step or sit at its start. */
  public align = input<ProgressStepsAlign>(PROGRESS_STEPS_ALIGNS.CENTER);
}
