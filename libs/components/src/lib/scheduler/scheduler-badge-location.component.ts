import { Component, input, ViewEncapsulation } from '@angular/core';
import { IconDirective, LOCATION_ICON, provideIcons } from '../icon';
import { AppointmentTreeNode } from './headless';

/**
 * The location piece of an appointment badge, stamped by `etSchedulerBadgeLocation`. Renders
 * nothing when the appointment has no `location`.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-badge-location',
  template: `
    @if (node().appointment.location; as location) {
      <span class="et-scheduler-appointment-location">
        <i class="et-scheduler-appointment-location-icon" aria-hidden="true" etIcon="et-location"></i>
        <span class="et-scheduler-appointment-location-text">{{ location }}</span>
      </span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(LOCATION_ICON)],
})
export class SchedulerBadgeLocationComponent {
  public node = input.required<AppointmentTreeNode>();
}
