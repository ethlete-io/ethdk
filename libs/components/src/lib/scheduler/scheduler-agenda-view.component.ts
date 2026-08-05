import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ProvideColorDirective, injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { SchedulerAgendaDirective, SchedulerDirective } from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { Appointment } from './scheduler.types';

/** The default agenda list: one section per visible day, appointments as full-width badges indented by chain depth. */
@Component({
  selector: 'et-scheduler-agenda-view',
  templateUrl: './scheduler-agenda-view.component.html',
  styleUrl: './scheduler-agenda-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  hostDirectives: [SchedulerAgendaDirective],
  host: {
    class: 'et-scheduler-agenda-view',
  },
})
export class SchedulerAgendaViewComponent {
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected agenda = inject(SchedulerAgendaDirective);

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
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
