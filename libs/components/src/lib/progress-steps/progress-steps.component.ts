import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Lays out a row of `et-progress-step`s with automatic step numbering and a connecting line
 * between them - project the steps in order, each with its own `state`.
 *
 * @example
 * <et-progress-steps>
 *   <et-progress-step state="complete">Account</et-progress-step>
 *   <et-progress-step state="current">Shipping</et-progress-step>
 *   <et-progress-step state="upcoming">Payment</et-progress-step>
 * </et-progress-steps>
 */
@Component({
  selector: 'et-progress-steps',
  template: `<ng-content />`,
  styleUrl: './progress-steps.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-progress-steps',
  },
})
export class ProgressStepsComponent {}
