import { Component, input, ViewEncapsulation } from '@angular/core';

export const PROGRESS_STEPS_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

export type ProgressStepsOrientation = (typeof PROGRESS_STEPS_ORIENTATIONS)[keyof typeof PROGRESS_STEPS_ORIENTATIONS];

/**
 * Lays out a row - or, with `orientation="vertical"`, a column - of `et-progress-step`s with automatic
 * step numbering and a connecting line between them. Project the steps in order, each with its own
 * `state`.
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
    '[attr.data-orientation]': 'orientation()',
  },
})
export class ProgressStepsComponent {
  /** Whether the steps run across the row or down a column. The connector follows. */
  public orientation = input<ProgressStepsOrientation>(PROGRESS_STEPS_ORIENTATIONS.HORIZONTAL);
}
