import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { format } from 'date-fns';
import { AppointmentTreeNode, SchedulerDirective } from './headless';

/**
 * The time-range piece of an appointment badge, stamped by `etSchedulerBadgeTimeRange`. Renders
 * nothing for an all-day appointment, which has no meaningful start/end time to show.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-badge-time-range',
  template: `
    @if (range(); as range) {
      <span class="et-scheduler-appointment-time-range">{{ range }}</span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class SchedulerBadgeTimeRangeComponent {
  private scheduler = inject(SchedulerDirective, { optional: true });
  public node = input.required<AppointmentTreeNode>();

  protected range = computed(() => {
    const appointment = this.node().appointment;

    if (appointment.allDay) {
      return null;
    }

    const locale = this.scheduler?.effectiveLocale();
    const options = locale ? { locale } : undefined;

    return `${format(appointment.start, 'HH:mm', options)}–${format(appointment.end, 'HH:mm', options)}`;
  });
}
