import { Directive, computed, input, model, output, signal } from '@angular/core';
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
import {
  Appointment,
  AppointmentId,
  SchedulerAppointmentDrag,
  SchedulerAppointmentDragMode,
  SchedulerAppointmentReschedule,
  SchedulerDraftRange,
  SchedulerView,
  SchedulerVisibleRange,
} from '../scheduler.types';
import { buildAppointmentTree, countDescendants } from './internals/scheduler-tree';

export type { AppointmentTreeNode } from './internals/scheduler-tree';
export { countDescendants };

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

  /**
   * How many days the agenda view lists, counted from {@link focusedDate}'s own day rather than
   * from its week - the lever an open-ended "load more as you scroll" agenda grows. `null` keeps
   * the agenda on the week view's window, so switching between the two keeps the same days.
   */
  public agendaDays = input<number | null>(null);

  /**
   * Emits when a move or resize lands the appointment somewhere else - see
   * {@link commitAppointmentDrag}. `appointments` is yours, so nothing has changed until you apply
   * it; the preview drops on release, so persisting asynchronously wants an optimistic write.
   */
  public appointmentReschedule = output<SchedulerAppointmentReschedule<TExtra>>();

  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public effectiveFirstDayOfWeek = computed<SchedulerWeekStartsOn>(
    () =>
      this.firstDayOfWeek() ??
      (this.effectiveLocale()?.options?.weekStartsOn as SchedulerWeekStartsOn | undefined) ??
      1,
  );

  private effectiveAgendaDays = computed(() => {
    const dayCount = this.agendaDays();

    return dayCount === null ? null : Math.max(1, Math.floor(dayCount));
  });

  /**
   * The date span the active view is showing. Month pads out to full weeks, covering the grid's
   * leading/trailing days from adjacent months; week and agenda share one 7-day window, since
   * agenda is a flat render of the same days the week view lays out on a grid - unless
   * {@link agendaDays} opts the agenda out of that window.
   */
  public visibleRange = computed<SchedulerVisibleRange>(() => {
    const date = this.focusedDate();
    const weekStartsOn = this.effectiveFirstDayOfWeek();

    switch (this.view()) {
      case 'day':
        return { start: startOfDay(date), end: endOfDay(date) };
      case 'agenda': {
        const dayCount = this.effectiveAgendaDays();

        if (dayCount === null) {
          return { start: startOfWeek(date, { weekStartsOn }), end: endOfWeek(date, { weekStartsOn }) };
        }

        return { start: startOfDay(date), end: endOfDay(addDays(date, dayCount - 1)) };
      }
      case 'week':
        return { start: startOfWeek(date, { weekStartsOn }), end: endOfWeek(date, { weekStartsOn }) };
      case 'month':
      default:
        return {
          start: startOfWeek(startOfMonth(date), { weekStartsOn }),
          end: endOfWeek(endOfMonth(date), { weekStartsOn }),
        };
    }
  });

  /**
   * The appointment being moved or resized by a drag, or `null` - see {@link beginAppointmentDrag}.
   * Set only while the pointer is down.
   */
  public appointmentDrag = signal<SchedulerAppointmentDrag<TExtra> | null>(null);

  /**
   * {@link appointments} with an in-flight {@link appointmentDrag} applied to the one being dragged.
   * Every layout derives from this, so a drag previews itself in whichever view is on screen.
   */
  public effectiveAppointments = computed(() => {
    const drag = this.appointmentDrag();
    const appointments = this.appointments();

    if (!drag) return appointments;

    return appointments.map((appointment) =>
      appointment.id === drag.appointment.id ? { ...appointment, start: drag.start, end: drag.end } : appointment,
    );
  });

  /** {@link effectiveAppointments}, arranged into sub-appointment chains - see `buildAppointmentTree`. */
  public appointmentTree = computed(() => buildAppointmentTree(this.effectiveAppointments()));

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

  /** {@link effectiveAppointments} that overlap {@link visibleRange} at all - not yet bucketed per view. */
  public visibleAppointments = computed(() => {
    const { start, end } = this.visibleRange();

    return this.effectiveAppointments().filter((appointment) => appointment.start <= end && appointment.end >= start);
  });

  /** The selected appointment itself, or `null` - resolved from {@link selectedAppointmentId}. */
  public selectedAppointment = computed(
    () => this.appointments().find((appointment) => appointment.id === this.selectedAppointmentId()) ?? null,
  );

  /**
   * The range being dragged out on a view to create an appointment, or `null`. A view writes it
   * through {@link beginDraftRange} / {@link extendDraftRange} / {@link commitDraftRange}; the host
   * clears it with {@link clearDraftRange} once it is done with it.
   */
  public draftRange = signal<SchedulerDraftRange | null>(null);

  /**
   * The element a host should anchor its edit surface to - the appointment that was clicked, or the
   * range that was just dragged out. `null` whenever the interaction had no element behind it, such
   * as a selection made by writing {@link selectedAppointmentId} directly.
   */
  public surfaceAnchor = signal<HTMLElement | null>(null);

  /** Where the current drag started, so extending backwards past it flips the range. */
  private draftAnchor: Date | null = null;

  /**
   * Steps {@link focusedDate} forward by the active view's unit - a day, a week, a month, or the
   * agenda's own {@link agendaDays} span when it has one.
   */
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

  /**
   * Draws a drag-to-create range outright, for a view whose units are not minutes on an axis - the
   * month grid works in whole days and computes both ends itself.
   */
  public setDraftRange(range: Omit<SchedulerDraftRange, 'phase'>) {
    this.draftRange.set({ ...range, phase: 'dragging' });
  }

  /** Starts a drag-to-create range at `at`. The range covers `at` until {@link extendDraftRange}. */
  public beginDraftRange(at: Date, minimumDuration: number) {
    this.draftAnchor = at;
    this.draftRange.set({ start: at, end: new Date(at.getTime() + minimumDuration), phase: 'dragging' });
  }

  /** Grows the active drag-to-create range to `to`, flipping it when dragged above its anchor. */
  public extendDraftRange(to: Date, minimumDuration: number) {
    const anchor = this.draftAnchor;

    if (!anchor) return;

    const forward = to.getTime() >= anchor.getTime() + minimumDuration;
    const start = forward ? anchor : new Date(Math.min(to.getTime(), anchor.getTime() - minimumDuration));
    const end = forward ? to : anchor;

    this.draftRange.set({ start, end, phase: 'dragging' });
  }

  /**
   * Releases the drag, leaving the range in place for the host to open its create surface over.
   * Only a range still being dragged commits: a pointer released on an already committed range -
   * a click on the drawn selection while its surface is open - must not re-commit it and reopen
   * that surface.
   */
  public commitDraftRange() {
    this.draftAnchor = null;
    this.draftRange.update((range) => (range?.phase === 'dragging' ? { ...range, phase: 'committed' } : range));
  }

  /** Drops the drag-to-create range - a cancelled gesture, or a create surface that closed. */
  public clearDraftRange() {
    this.draftAnchor = null;
    this.draftRange.set(null);
  }

  /**
   * Starts moving or resizing an appointment already on the calendar, previewed at its current time
   * until the first {@link updateAppointmentDrag}. A view calls this once its gesture has committed,
   * so a press that stays a click never begins one.
   */
  public beginAppointmentDrag(appointment: Appointment<TExtra>, mode: SchedulerAppointmentDragMode) {
    this.appointmentDrag.set({ appointment, mode, start: appointment.start, end: appointment.end });
  }

  /**
   * Previews the dragged appointment at `start`-`end`. Both ends come from the view: only it knows
   * what a pointer position means on its own geometry, and what its snapping and minimum are.
   */
  public updateAppointmentDrag(start: Date, end: Date) {
    this.appointmentDrag.update((drag) => (drag ? { ...drag, start, end } : null));
  }

  /**
   * Releases the drag, emitting {@link appointmentReschedule} when it landed on a different range.
   * The preview goes with it - the appointment renders from {@link appointments} again.
   */
  public commitAppointmentDrag() {
    const drag = this.appointmentDrag();

    this.appointmentDrag.set(null);

    if (!drag) return;

    const { appointment, start, end } = drag;

    if (start.getTime() === appointment.start.getTime() && end.getTime() === appointment.end.getTime()) return;

    this.appointmentReschedule.emit({ appointment: { ...appointment, start, end }, previous: appointment });
  }

  /** Drops the drag without emitting - a gesture the browser took away, so no range was chosen. */
  public clearAppointmentDrag() {
    this.appointmentDrag.set(null);
  }

  private stepBy(step: 1 | -1) {
    switch (this.view()) {
      case 'day':
        return this.focusedDate.set(addDays(this.focusedDate(), step));
      case 'agenda':
        return this.focusedDate.set(addDays(this.focusedDate(), step * (this.effectiveAgendaDays() ?? 7)));
      case 'week':
        return this.focusedDate.set(addDays(this.focusedDate(), step * 7));
      case 'month':
      default:
        return this.focusedDate.set(addMonths(this.focusedDate(), step));
    }
  }
}
