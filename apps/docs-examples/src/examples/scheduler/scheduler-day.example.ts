import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Appointment, AppointmentId, provideSchedulerEditSurface, SCHEDULER_IMPORTS } from '@ethlete/components';
import { APPOINTMENTS } from './scheduler-day.data';

@Component({
  selector: 'app-scheduler-day-example',
  template: `
    <et-scheduler
      [(selectedAppointmentId)]="selectedAppointmentId"
      [appointments]="appointments()"
      (appointmentSave)="saveAppointment($event)"
      (appointmentReschedule)="saveAppointment($event.appointment)"
      (appointmentsDelete)="deleteAppointments($event)"
      view="day"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCHEDULER_IMPORTS],
  providers: [provideSchedulerEditSurface()],
})
export class SchedulerDayExampleComponent {
  protected appointments = signal<Appointment[]>(APPOINTMENTS);
  protected selectedAppointmentId = signal<string | null>(null);

  protected saveAppointment(appointment: Appointment) {
    this.appointments.update((appointments) =>
      appointments.some((candidate) => candidate.id === appointment.id)
        ? appointments.map((candidate) => (candidate.id === appointment.id ? appointment : candidate))
        : [...appointments, appointment],
    );
  }

  protected deleteAppointments(ids: readonly AppointmentId[]) {
    this.appointments.update((appointments) => appointments.filter((appointment) => !ids.includes(appointment.id)));
  }
}
