import { Component, ElementRef, ViewEncapsulation, computed, inject } from '@angular/core';
import { format, isSameMonth, isSameYear } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { LabelDirective, SEGMENTED_BUTTON_IMPORTS } from '../forms';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerFeatureHost } from './headless';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { injectSchedulerLabels } from './scheduler-labels';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';
import { Appointment, SchedulerView } from './scheduler.types';

@Component({
  selector: 'et-scheduler',
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    ...SEGMENTED_BUTTON_IMPORTS,
    LabelDirective,
    IconDirective,
    SchedulerAgendaViewComponent,
    SchedulerMonthViewComponent,
    SchedulerTimeGridViewComponent,
  ],
  providers: [provideIcons(CHEVRON_ICON), { provide: SCHEDULER_FEATURE_HOST, useExisting: SchedulerComponent }],
  hostDirectives: [
    {
      directive: SchedulerDirective,
      inputs: ['appointments', 'view', 'focusedDate', 'selectedAppointmentId', 'locale', 'firstDayOfWeek'],
      outputs: ['viewChange', 'focusedDateChange', 'selectedAppointmentIdChange'],
    },
  ],
  host: {
    class: 'et-scheduler',
  },
})
export class SchedulerComponent implements SchedulerFeatureHost {
  private labels = injectSchedulerLabels();

  /**
   * The headless directive behind this scheduler - everything `[etScheduler]` exposes, for chrome
   * of your own around or instead of the default toolbar (`<et-scheduler #s>` then `s.headless`).
   */
  public headless = inject(SchedulerDirective);

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public previousLabel = computed(() => this.labels().previous);
  public nextLabel = computed(() => this.labels().next);
  public todayLabel = computed(() => this.labels().today);
  public switchViewLabel = computed(() => this.labels().switchView);
  public monthViewLabel = computed(() => this.labels().month);
  public weekViewLabel = computed(() => this.labels().week);
  public dayViewLabel = computed(() => this.labels().day);
  public agendaViewLabel = computed(() => this.labels().agenda);

  public headerLabel = computed(() => {
    const locale = this.headless.effectiveLocale();
    const options = locale ? { locale } : undefined;
    const view = this.headless.view();

    if (view === 'day') {
      return format(this.headless.focusedDate(), 'EEEE, d MMMM yyyy', options);
    }

    if (view === 'week' || view === 'agenda') {
      const { start, end } = this.headless.visibleRange();

      if (isSameMonth(start, end)) {
        return `${format(start, 'd', options)} – ${format(end, 'd MMMM yyyy', options)}`;
      }

      if (isSameYear(start, end)) {
        return `${format(start, 'd MMMM', options)} – ${format(end, 'd MMMM yyyy', options)}`;
      }

      return `${format(start, 'd MMMM yyyy', options)} – ${format(end, 'd MMMM yyyy', options)}`;
    }

    return format(this.headless.focusedDate(), 'LLLL yyyy', options);
  });

  /** Bound to the view-switch's `(valueChange)` - safe to cast since every `<et-segmented-button>` below carries a `SchedulerView` literal. */
  public setView(value: unknown) {
    this.headless.view.set(value as SchedulerView);
  }

  /** The scheduler's own element. Part of the feature contract (a feature is a directive on it). */
  public get element(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public get appointmentTree() {
    return this.headless.appointmentTree;
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public get selectedAppointment() {
    return this.headless.selectedAppointment;
  }

  public appointments(): readonly Appointment[] {
    return this.headless.visibleAppointments();
  }
}
