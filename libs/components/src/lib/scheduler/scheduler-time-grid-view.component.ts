import { NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ProvideColorDirective, injectStyleManager } from '@ethlete/core';
import { format, setHours, startOfDay } from 'date-fns';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerTimeGridDirective } from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { Appointment } from './scheduler.types';

const HOURS = /* @__PURE__ */ Array.from({ length: 24 }, (_, hour) => hour);

/**
 * The default time grid: an hour axis, an all-day strip, and appointments packed into
 * overlap-free columns. Backs both the week and day views - the day view is this same component
 * with a one-day visible range, not a separate implementation.
 */
@Component({
  selector: 'et-scheduler-time-grid-view',
  templateUrl: './scheduler-time-grid-view.component.html',
  styleUrl: './scheduler-time-grid-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, NgComponentOutlet],
  hostDirectives: [SchedulerTimeGridDirective],
  host: {
    class: 'et-scheduler-time-grid-view',
  },
})
export class SchedulerTimeGridViewComponent {
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected grid = inject(SchedulerTimeGridDirective);

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });

  protected hours = computed(() => {
    const locale = this.scheduler?.effectiveLocale();
    const reference = startOfDay(new Date());

    return HOURS.map((hour) => ({
      hour,
      label: format(setHours(reference, hour), 'HH:mm', locale ? { locale } : undefined),
    }));
  });

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }

  /** UI contributed by badge features (title, time range, …) - see `registerBadgeAdornment`. */
  protected badgeAdornments() {
    return this.featureHost?.badgeAdornments() ?? [];
  }

  protected weekdayLabel(date: Date) {
    const locale = this.scheduler?.effectiveLocale();

    return format(date, 'EEE', locale ? { locale } : undefined);
  }

  protected isSelected(appointment: Appointment) {
    return this.scheduler?.selectedAppointmentId() === appointment.id;
  }

  protected select(appointment: Appointment) {
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }
}
