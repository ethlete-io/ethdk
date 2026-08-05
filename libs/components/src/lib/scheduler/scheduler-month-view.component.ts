import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ProvideColorDirective, injectStyleManager } from '@ethlete/core';
import { MENU_IMPORTS } from '../menu';
import { SchedulerDirective, SchedulerMonthDirective } from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/** The default month grid: one day cell per day, appointments as one-line badges with a "+N more" overflow. */
@Component({
  selector: 'et-scheduler-month-view',
  templateUrl: './scheduler-month-view.component.html',
  styleUrl: './scheduler-month-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS, ProvideColorDirective],
  hostDirectives: [SchedulerMonthDirective],
  host: {
    class: 'et-scheduler-month-view',
  },
})
export class SchedulerMonthViewComponent {
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected month = inject(SchedulerMonthDirective);
  protected labels = injectSchedulerLabels();

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }

  protected weekdays() {
    return this.scheduler?.weekdays() ?? [];
  }

  protected isSelected(appointment: Appointment) {
    return this.scheduler?.selectedAppointmentId() === appointment.id;
  }

  protected select(appointment: Appointment) {
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }
}
