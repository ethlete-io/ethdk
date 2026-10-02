import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';
import { DEMO_APPOINTMENTS } from './scheduler-storybook.component';

@Component({
  selector: 'et-sb-scheduler-read-only',
  template: `
    <div class="p-8 font-sans">
      <et-scheduler [(selectedAppointmentId)]="selectedAppointmentId" [appointments]="APPOINTMENTS" />

      <p class="mt-4 opacity-60">Selected: {{ selectedTitle() ?? 'none' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS],
})
export class SchedulerReadOnlyStorybookComponent {
  protected readonly APPOINTMENTS = DEMO_APPOINTMENTS;
  protected selectedAppointmentId = signal<string | null>(null);

  protected selectedTitle = computed(
    () => this.APPOINTMENTS.find((appointment) => appointment.id === this.selectedAppointmentId())?.title ?? null,
  );
}
