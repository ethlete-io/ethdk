import { Component, ViewEncapsulation, computed, input, linkedSignal, signal } from '@angular/core';
import { addDays, addHours, startOfWeek } from 'date-fns';
import { Appointment, AppointmentId, SchedulerView } from '../scheduler.types';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
const at = (dayOffset: number, hour: number) => addHours(addDays(weekStart, dayOffset), hour);

const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: 'standup',
    parentId: null,
    title: 'Daily standup',
    start: at(0, 9),
    end: at(0, 9.25),
    colorToken: 'brand',
  },
  {
    id: 'launch-project',
    parentId: null,
    title: 'Launch project',
    start: at(2, 10),
    end: at(2, 16),
    colorToken: 'success',
    location: 'Main conference room',
  },
  {
    id: 'launch-project-design',
    parentId: 'launch-project',
    title: 'Design review',
    start: at(2, 10),
    end: at(2, 11),
    colorToken: 'success',
  },
  {
    id: 'launch-project-design-feedback',
    parentId: 'launch-project-design',
    title: 'Address feedback',
    start: at(2, 11),
    end: at(2, 12),
    colorToken: 'success',
  },
  {
    id: 'offsite',
    parentId: null,
    title: 'Team offsite',
    start: at(4, 0),
    end: at(6, 23),
    allDay: true,
    colorToken: 'warning',
  },
  {
    id: 'call-1',
    parentId: null,
    title: 'Client call: Acme',
    start: at(5, 9),
    end: at(5, 10),
    colorToken: 'danger',
    location: 'Zoom',
  },
  { id: 'call-2', parentId: null, title: 'Client call: Globex', start: at(5, 11), end: at(5, 12), colorToken: 'brand' },
  {
    id: 'call-3',
    parentId: null,
    title: '1:1 with manager',
    start: at(5, 13),
    end: at(5, 13.5),
    colorToken: 'success',
  },
  { id: 'call-4', parentId: null, title: 'Sprint planning', start: at(5, 14), end: at(5, 15.5), colorToken: 'warning' },
  {
    id: 'call-6',
    parentId: null,
    title: 'Design sync',
    start: at(5, 14.5),
    end: at(5, 15),
    colorToken: 'brand',
  },
  { id: 'call-5', parentId: null, title: 'Retro', start: at(5, 16), end: at(5, 17), colorToken: 'danger' },
];

@Component({
  selector: 'et-sb-scheduler',
  template: `
    <div [style.max-inline-size]="containerWidth()" class="p-8 font-sans">
      <et-scheduler
        [(view)]="view"
        [(selectedAppointmentId)]="selectedAppointmentId"
        [appointments]="appointments()"
        [etSchedulerBadgeLocation]="{ enabled: showLocationBadge() }"
        (appointmentSave)="saveAppointment($event)"
        (appointmentsDelete)="deleteAppointments($event)"
      />

      <p class="mt-4 text-sm opacity-60">Selected: {{ selectedTitle() ?? 'none' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS],
})
export class SchedulerStorybookComponent {
  public initialView = input<SchedulerView>('month');
  public showLocationBadge = input(true);
  public containerWidth = input<string | null>(null);
  protected view = linkedSignal(() => this.initialView());
  protected appointments = signal(DEMO_APPOINTMENTS);
  protected selectedAppointmentId = signal<string | null>(null);

  protected selectedTitle = computed(
    () => this.appointments().find((appointment) => appointment.id === this.selectedAppointmentId())?.title ?? null,
  );

  protected saveAppointment(appointment: Appointment) {
    this.appointments.update((appointments) => {
      const exists = appointments.some((candidate) => candidate.id === appointment.id);

      return exists
        ? appointments.map((candidate) => (candidate.id === appointment.id ? appointment : candidate))
        : [...appointments, appointment];
    });
  }

  protected deleteAppointments(ids: readonly AppointmentId[]) {
    this.appointments.update((appointments) => appointments.filter((appointment) => !ids.includes(appointment.id)));
  }
}
