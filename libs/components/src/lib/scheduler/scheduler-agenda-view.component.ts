import { NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ProvideColorDirective, injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { SCHEDULER_FEATURE_HOST, SchedulerAgendaDirective, SchedulerDirective } from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { Appointment } from './scheduler.types';

/** The default agenda list: one section per visible day, appointments as full-width badges indented by chain depth. */
@Component({
  selector: 'et-scheduler-agenda-view',
  templateUrl: './scheduler-agenda-view.component.html',
  styleUrl: './scheduler-agenda-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, NgComponentOutlet],
  hostDirectives: [SchedulerAgendaDirective],
  host: {
    class: 'et-scheduler-agenda-view',
  },
})
export class SchedulerAgendaViewComponent {
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected agenda = inject(SchedulerAgendaDirective);

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });

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

  protected select(appointment: Appointment, element: HTMLElement) {
    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }
}
