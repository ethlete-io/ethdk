import { Directive, computed, input, model } from '@angular/core';
import {
  Locale,
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { injectDateLocale } from '../../forms/date-time/date-time-formats';
import { Appointment, AppointmentId, SchedulerView, SchedulerVisibleRange } from '../scheduler.types';
import { buildAppointmentTree } from './internals/scheduler-tree';

export type { AppointmentTreeNode } from './internals/scheduler-tree';

/** 0 = Sunday … 6 = Saturday. */
export type SchedulerWeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A localized weekday name, in both its short (`Mon`) and long (`Monday`) form. */
export type SchedulerWeekday = {
  short: string;
  long: string;
};

/**
 * Headless scheduler state: the active view, the focused date, the visible date range each view
 * derives from it, and the appointment set arranged into sub-appointment chains. Operates on
 * `Date` objects and plain data only - rendering, badges and the edit surface are separate
 * features layered on top (see `SCHEDULER_FEATURE_HOST`).
 */
@Directive({
  selector: '[etScheduler]',
  exportAs: 'etScheduler',
})
export class SchedulerDirective<TExtra = unknown> {
  private defaultLocale = injectDateLocale();

  /** Every appointment the scheduler knows about - not pre-filtered to the visible range. */
  public appointments = input<readonly Appointment<TExtra>[]>([]);

  /** Which view is on screen. */
  public view = model<SchedulerView>('month');

  /** The date every view's visible range is derived from. */
  public focusedDate = model<Date>(new Date());

  /** The currently selected appointment, or `null`. */
  public selectedAppointmentId = model<AppointmentId | null>(null);

  public locale = input<Locale | null>(null);
  /** Defaults to the locale's week start, else Monday. */
  public firstDayOfWeek = input<SchedulerWeekStartsOn | undefined>(undefined);

  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public effectiveFirstDayOfWeek = computed<SchedulerWeekStartsOn>(
    () =>
      this.firstDayOfWeek() ??
      (this.effectiveLocale()?.options?.weekStartsOn as SchedulerWeekStartsOn | undefined) ??
      1,
  );

  /**
   * The date span the active view is showing. Month pads out to full weeks, covering the grid's
   * leading/trailing days from adjacent months; week and agenda share one 7-day window, since
   * agenda is a flat render of the same days the week view lays out on a grid.
   */
  public visibleRange = computed<SchedulerVisibleRange>(() => {
    const date = this.focusedDate();
    const weekStartsOn = this.effectiveFirstDayOfWeek();

    switch (this.view()) {
      case 'day':
        return { start: startOfDay(date), end: endOfDay(date) };
      case 'week':
      case 'agenda':
        return { start: startOfWeek(date, { weekStartsOn }), end: endOfWeek(date, { weekStartsOn }) };
      case 'month':
      default:
        return {
          start: startOfWeek(startOfMonth(date), { weekStartsOn }),
          end: endOfWeek(endOfMonth(date), { weekStartsOn }),
        };
    }
  });

  /** {@link appointments}, arranged into sub-appointment chains - see `buildAppointmentTree`. */
  public appointmentTree = computed(() => buildAppointmentTree(this.appointments()));

  /** The seven weekday names, starting from {@link effectiveFirstDayOfWeek} - for grid/agenda headers. */
  public weekdays = computed<SchedulerWeekday[]>(() => {
    const locale = this.effectiveLocale();
    const options = locale ? { locale } : undefined;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: this.effectiveFirstDayOfWeek() });

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = addDays(weekStart, dayIndex);

      return { short: format(day, 'EEEEEE', options), long: format(day, 'EEEE', options) };
    });
  });

  /** {@link appointments} that overlap {@link visibleRange} at all - not yet bucketed per view. */
  public visibleAppointments = computed(() => {
    const { start, end } = this.visibleRange();

    return this.appointments().filter((appointment) => appointment.start <= end && appointment.end >= start);
  });

  /** The selected appointment itself, or `null` - resolved from {@link selectedAppointmentId}. */
  public selectedAppointment = computed(
    () => this.appointments().find((appointment) => appointment.id === this.selectedAppointmentId()) ?? null,
  );

  /** Steps {@link focusedDate} forward by the active view's unit - a day, a week, or a month. */
  public next() {
    this.stepBy(1);
  }

  /** Steps {@link focusedDate} backward by the active view's unit. */
  public previous() {
    this.stepBy(-1);
  }

  /** Focuses today. */
  public goToToday() {
    this.focusedDate.set(startOfDay(new Date()));
  }

  private stepBy(step: 1 | -1) {
    switch (this.view()) {
      case 'day':
        return this.focusedDate.set(addDays(this.focusedDate(), step));
      case 'week':
      case 'agenda':
        return this.focusedDate.set(addDays(this.focusedDate(), step * 7));
      case 'month':
      default:
        return this.focusedDate.set(addMonths(this.focusedDate(), step));
    }
  }
}
