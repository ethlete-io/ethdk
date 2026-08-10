import { NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ProvideColorDirective, injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { SCHEDULER_FEATURE_HOST, SchedulerAgendaDirective, SchedulerDirective } from './headless';
import { buildSchedulerAgendaGuides } from './headless/internals/scheduler-agenda';
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

  protected days = computed(() =>
    this.agenda.days().map((day) => {
      const guides = buildSchedulerAgendaGuides(day.nodes);

      return {
        ...day,
        // deeper chains keep the last four levels rather than indenting off the edge - the elbow is
        // always the innermost guide, so slicing from the end keeps the row readable
        rows: day.nodes.map((node, index) => ({ node, guides: (guides[index] ?? []).slice(-4) })),
      };
    }),
  );

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
