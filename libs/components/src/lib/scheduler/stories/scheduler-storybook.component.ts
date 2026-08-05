import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { addDays, addHours, startOfDay } from 'date-fns';
import { Appointment } from '../scheduler.types';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';

const today = startOfDay(new Date());
const at = (dayOffset: number, hour: number) => addHours(addDays(today, dayOffset), hour);

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
  { id: 'call-1', parentId: null, title: 'Client call: Acme', start: at(5, 9), end: at(5, 10), colorToken: 'danger' },
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
  { id: 'call-5', parentId: null, title: 'Retro', start: at(5, 16), end: at(5, 17), colorToken: 'danger' },
];

@Component({
  selector: 'et-sb-scheduler',
  template: `
    <div class="max-w-4xl p-8 font-sans">
      <et-scheduler [(selectedAppointmentId)]="selectedAppointmentId" [appointments]="appointments()" />

      <p class="mt-4 text-sm opacity-60">Selected: {{ selectedTitle() ?? 'none' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS],
})
export class SchedulerStorybookComponent {
  protected appointments = signal(DEMO_APPOINTMENTS);
  protected selectedAppointmentId = signal<string | null>(null);

  protected selectedTitle = computed(
    () => this.appointments().find((appointment) => appointment.id === this.selectedAppointmentId())?.title ?? null,
  );
}
