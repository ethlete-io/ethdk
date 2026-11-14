import { Component, ViewEncapsulation } from '@angular/core';
import { ProgressStepsDirective } from './headless/progress-steps.directive';

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
  },
})
export class ProgressStepsComponent {}
