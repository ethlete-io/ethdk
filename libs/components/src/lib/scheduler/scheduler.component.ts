import { Component, ElementRef, ViewEncapsulation, computed, inject } from '@angular/core';
import { format } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerFeatureHost } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { Appointment } from './scheduler.types';

@Component({
  selector: 'et-scheduler',
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, SchedulerMonthViewComponent],
  providers: [provideIcons(CHEVRON_ICON), { provide: SCHEDULER_FEATURE_HOST, useExisting: SchedulerComponent }],
  hostDirectives: [
    {
      // `view` stays unforwarded until a second view exists to switch to - `<et-scheduler>` only
      // ever renders the month grid today, so exposing it would promise a switch with no effect.
      directive: SchedulerDirective,
      inputs: ['appointments', 'focusedDate', 'selectedAppointmentId', 'locale', 'firstDayOfWeek'],
      outputs: ['focusedDateChange', 'selectedAppointmentIdChange'],
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

  public headerLabel = computed(() => {
    const locale = this.headless.effectiveLocale();

    return format(this.headless.focusedDate(), 'LLLL yyyy', locale ? { locale } : undefined);
  });

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
