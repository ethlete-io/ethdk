import { Component, input, ViewEncapsulation } from '@angular/core';
import { AppointmentTreeNode } from './headless';

/**
 * The color-dot piece of an appointment badge, stamped by `etSchedulerBadgeColorDot`. Its color
 * comes from the ambient `[etProvideColor]` the badge button already carries, so this component
 * renders no color of its own - see the shared appointment badge styles.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-badge-color-dot',
  template: `<span class="et-scheduler-appointment-dot" aria-hidden="true"></span>`,
  encapsulation: ViewEncapsulation.None,
})
export class SchedulerBadgeColorDotComponent {
  /** The tree node this badge renders - unused here, present to satisfy `SchedulerBadgeAdornment`. */
  public node = input.required<AppointmentTreeNode>();
}
