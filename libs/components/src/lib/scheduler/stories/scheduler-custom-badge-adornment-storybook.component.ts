import { Component, Directive, ViewEncapsulation, computed, inject, Injector, input } from '@angular/core';
import { AppointmentTreeNode, injectSchedulerFeatureHost } from '../headless';
import { provideSchedulerEditSurface } from '../scheduler-edit-surface.provider';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';
import { Appointment } from '../scheduler.types';
import { DEMO_APPOINTMENTS } from './scheduler-storybook.component';

type TicketExtra = { ticket: string };

@Component({
  selector: 'et-sb-scheduler-ticket-badge',
  template: `
    @if (ticket(); as ticket) {
      <span class="ms-1 rounded-sm border border-current px-1 text-small whitespace-nowrap opacity-70">{{
        ticket
      }}</span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
class SchedulerTicketBadgeComponent {
  public node = input.required<AppointmentTreeNode<TicketExtra>>();

  protected ticket = computed(() => this.node().appointment.extra?.ticket ?? null);
}

@Directive({ selector: '[etSbSchedulerTicketBadge]' })
class SchedulerTicketBadgeDirective {
  constructor() {
    injectSchedulerFeatureHost<TicketExtra>('etSbSchedulerTicketBadge').registerBadgeAdornment({
      component: SchedulerTicketBadgeComponent,
      injector: inject(Injector),
      order: 5,
    });
  }
}

const TICKETED_APPOINTMENTS: Appointment<TicketExtra>[] = DEMO_APPOINTMENTS.map((appointment, index) => ({
  ...appointment,
  extra: index % 2 === 0 ? { ticket: 'ET-' + (100 + index) } : undefined,
}));

@Component({
  selector: 'et-sb-scheduler-custom-badge-adornment',
  template: `
    <div class="p-8 font-sans">
      <et-scheduler
        [appointments]="APPOINTMENTS"
        (appointmentSave)="lastSaved = $event"
        etSbSchedulerTicketBadge
        view="week"
      />

      <p class="mt-4 opacity-60">Last saved ticket: {{ lastSaved?.extra?.ticket ?? 'none' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS, SchedulerTicketBadgeDirective],
  providers: [provideSchedulerEditSurface()],
})
export class SchedulerCustomBadgeAdornmentStorybookComponent {
  protected readonly APPOINTMENTS = TICKETED_APPOINTMENTS;
  protected lastSaved: Appointment<TicketExtra> | null = null;
}
