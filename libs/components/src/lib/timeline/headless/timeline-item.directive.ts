import { Directive, computed, input } from '@angular/core';
import { ProgressStepState } from '../../progress-steps/headless/progress-step.directive';

/** The status of a timeline item. Same vocabulary as a progress step's state. */
export type TimelineItemStatus = ProgressStepState;

/**
 * The behavior of one timeline item, with no look: the `listitem` role, its optional `status` on
 * `data-status`, and `aria-current="step"` on the `current` one.
 *
 * @example
 * <li etTimelineItem status="error">Deployment failed</li>
 */
@Directive({
  selector: '[etTimelineItem]',
  exportAs: 'etTimelineItem',
  host: {
    role: 'listitem',
    '[attr.data-status]': 'status()',
    '[attr.aria-current]': 'ariaCurrent()',
  },
})
export class TimelineItemDirective {
  public status = input<TimelineItemStatus | null>(null);

  protected ariaCurrent = computed(() => (this.status() === 'current' ? 'step' : null));
}
