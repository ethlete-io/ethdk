import { Component, ViewEncapsulation, WritableSignal, computed, input, linkedSignal, signal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../../forms/form-field';
import { INPUT_IMPORTS } from '../../forms/input';
import { OverlayMainDirective } from '../../overlay';
import { SchedulerEditSurfaceDirective, injectSchedulerEditSurface } from '../headless';
import { provideSchedulerEditSurface } from '../scheduler-edit-surface.provider';
import { SCHEDULER_EDIT_SURFACE_IMPORTS, SCHEDULER_IMPORTS } from '../scheduler.imports';
import { Appointment, AppointmentId } from '../scheduler.types';
import { DEMO_APPOINTMENTS } from './scheduler-storybook.component';

type Ticket = { estimateHours: number };

@Component({
  selector: 'et-sb-scheduler-estimate-field',
  template: `
    <et-form-field>
      <et-label>Estimate (hours)</et-label>
      <et-input [value]="value()" (valueChange)="update($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS],
})
export class SchedulerEstimateFieldStorybookComponent {
  public draft = input.required<WritableSignal<Appointment<Ticket>>>();

  protected value = computed(() => String(this.draft()().extra?.estimateHours ?? ''));

  protected update(value: string) {
    this.draft().update((appointment) => ({ ...appointment, extra: { estimateHours: Number(value) } }));
  }
}

@Component({
  selector: 'et-sb-scheduler-ticket-surface',
  template: `
    <et-scheduler-edit-surface-header>
      {{ header() }}
      <et-scheduler-edit-surface-actions>
        <et-scheduler-edit-add-sub-appointment-item />
        <button (click)="clearEstimate()" et-menu-item type="button">Clear estimate</button>
        <et-scheduler-edit-delete-item />
      </et-scheduler-edit-surface-actions>
    </et-scheduler-edit-surface-header>

    <et-overlay-body>
      <et-scheduler-edit-surface-breadcrumb />

      <et-scheduler-edit-surface-fields>
        <et-scheduler-edit-title #title [draft]="surface.draft" />
        <et-scheduler-edit-time-range #timeRange [draft]="surface.draft" />
        <et-sb-scheduler-estimate-field [draft]="surface.draft" />
        <et-scheduler-edit-description [draft]="surface.draft" />
      </et-scheduler-edit-surface-fields>

      <et-scheduler-edit-surface-children />
    </et-overlay-body>

    <et-scheduler-edit-surface-footer [canSave]="title.valid() && timeRange.valid() && estimateValid()" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCHEDULER_EDIT_SURFACE_IMPORTS, SchedulerEstimateFieldStorybookComponent],
  hostDirectives: [
    OverlayMainDirective,
    { directive: SchedulerEditSurfaceDirective, inputs: ['appointment', 'appointments'] },
  ],
})
export class SchedulerTicketSurfaceStorybookComponent {
  protected surface = injectSchedulerEditSurface<Ticket>();

  protected header = computed(() => {
    const estimate = this.surface.currentAppointment().extra?.estimateHours;

    return estimate === undefined ? 'Ticket' : 'Ticket - ' + estimate + ' h';
  });

  protected estimateValid = computed(() => {
    const estimate = this.surface.draft().extra?.estimateHours;

    return estimate === undefined || (Number.isFinite(estimate) && estimate >= 0);
  });

  protected clearEstimate() {
    this.surface.draft.update((appointment) => ({ ...appointment, extra: undefined }));
  }
}

const TICKETS: Appointment<Ticket>[] = DEMO_APPOINTMENTS.map((appointment, index) => ({
  ...appointment,
  extra: index % 2 === 0 ? { estimateHours: index + 1 } : undefined,
}));

@Component({
  selector: 'et-sb-scheduler-custom-edit-field',
  template: `
    <div class="p-8 font-sans">
      <et-scheduler
        [(selectedAppointmentId)]="selectedAppointmentId"
        [appointments]="appointments()"
        (appointmentSave)="save($event)"
        (appointmentsDelete)="remove($event)"
        view="week"
      />

      <p class="mt-4 opacity-60">Last saved estimate: {{ lastEstimate() ?? 'none' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS],
  providers: [provideSchedulerEditSurface({ component: SchedulerTicketSurfaceStorybookComponent })],
})
export class SchedulerCustomEditFieldStorybookComponent {
  protected appointments = linkedSignal<Appointment<Ticket>[]>(() => TICKETS);
  protected selectedAppointmentId = signal<string | null>(null);
  protected lastEstimate = signal<number | null>(null);

  protected save(appointment: Appointment) {
    const ticket = appointment as Appointment<Ticket>;

    this.lastEstimate.set(ticket.extra?.estimateHours ?? null);
    this.appointments.update((appointments) =>
      appointments.some((candidate) => candidate.id === ticket.id)
        ? appointments.map((candidate) => (candidate.id === ticket.id ? ticket : candidate))
        : [...appointments, ticket],
    );
  }

  protected remove(ids: readonly AppointmentId[]) {
    this.appointments.update((appointments) => appointments.filter((appointment) => !ids.includes(appointment.id)));
  }
}
