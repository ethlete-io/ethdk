import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  Appointment,
  AppointmentId,
  SchedulerBusinessHours,
  provideSchedulerEditSurface,
  SCHEDULER_IMPORTS,
} from '@ethlete/components';
import { APPOINTMENTS } from './scheduler-business-hours.data';

@Component({
  selector: 'app-scheduler-business-hours-example',
  template: `
    <et-scheduler
      [(selectedAppointmentId)]="selectedAppointmentId"
      [appointments]="appointments()"
      [businessHours]="businessHours"
      (appointmentSave)="saveAppointment($event)"
      (appointmentReschedule)="saveAppointment($event.appointment)"
      (appointmentsDelete)="deleteAppointments($event)"
      view="week"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCHEDULER_IMPORTS],
  providers: [provideSchedulerEditSurface()],
})
export class SchedulerBusinessHoursExampleComponent {
  protected appointments = signal<Appointment[]>(APPOINTMENTS);
  protected selectedAppointmentId = signal<string | null>(null);

  public businessHours: SchedulerBusinessHours[] = [
    { daysOfWeek: [1, 2, 3, 4], start: '08:00', end: '12:00' },
    { daysOfWeek: [1, 2, 3, 4], start: '13:00', end: '18:00' },
    { daysOfWeek: [5], start: '08:00', end: '14:00' },
  ];

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
