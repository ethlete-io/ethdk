import { Component, input, ViewEncapsulation } from '@angular/core';
import { AppointmentTreeNode } from './headless';

/**
 * The title piece of an appointment badge, stamped by `etSchedulerBadgeTitle`.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-badge-title',
  template: `<span class="et-scheduler-appointment-title">{{ node().appointment.title }}</span>`,
  encapsulation: ViewEncapsulation.None,
})
export class SchedulerBadgeTitleComponent {
  public node = input.required<AppointmentTreeNode>();
}
