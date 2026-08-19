import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ProvideColorDirective, injectRenderer, injectStyleManager } from '@ethlete/core';
import { addDays, differenceInCalendarDays, endOfDay, startOfDay } from 'date-fns';
import { MENU_IMPORTS } from '../menu';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerMonthDirective } from './headless';
import { startSchedulerDragGesture } from './headless/internals/scheduler-drag-gesture';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/** The default month grid: one day cell per day, appointments as one-line badges with a "+N more" overflow. */
@Component({
  selector: 'et-scheduler-month-view',
  templateUrl: './scheduler-month-view.component.html',
  styleUrl: './scheduler-month-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS, ProvideColorDirective, NgComponentOutlet],
  hostDirectives: [SchedulerMonthDirective],
  host: {
    class: 'et-scheduler-month-view',
  },
})
export class SchedulerMonthViewComponent {
  private scheduler = inject(SchedulerDirective, { optional: true });
  protected month = inject(SchedulerMonthDirective);
  protected labels = injectSchedulerLabels();

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private appointmentDrag = inject(SchedulerAppointmentDragDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();
  private weekRows = viewChildren<ElementRef<HTMLElement>>('weekRow');
  private cells = viewChildren<ElementRef<HTMLElement>>('cell');
  public draftAnchor = viewChild<ElementRef<HTMLElement>>('draftAnchor');

  /** Whether the `etSchedulerAppointmentDrag` feature is present and on - see that directive. */
  protected canDragAppointments = computed(() => this.appointmentDrag?.isEnabled() ?? false);

  /** Whether the press now ending moved a badge, rather than being a click on it - see {@link select}. */
  private hasDragged = false;

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }

  /** UI contributed by badge features (title, time range, …) - see `registerBadgeAdornment`. */
  protected badgeAdornments() {
    return this.featureHost?.badgeAdornments() ?? [];
  }

  protected weekdays() {
    return this.scheduler?.weekdays() ?? [];
  }

  protected isSelected(appointment: Appointment) {
    return this.scheduler?.selectedAppointmentId() === appointment.id;
  }

  protected select(appointment: Appointment, element: HTMLElement | null = null) {
    // only a `pointerdown` sets this, and one always precedes the click it belongs to - which is why
    // the flag can live here and cannot go stale
    if (this.hasDragged) return;

    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }

  protected isDrafted(date: Date) {
    const draft = this.scheduler?.draftRange();

    return !!draft && date >= startOfDay(draft.start) && date <= draft.end;
  }

  protected isDragging(appointment: Appointment) {
    return this.scheduler?.appointmentDrag()?.appointment.id === appointment.id;
  }

  /**
   * The cells a dragged appointment would land on. Needed on top of the badge's own preview: a target
   * cell already at `maxVisiblePerCell` collapses the badge into its overflow menu, leaving the drag
   * with no feedback at all.
   */
  protected isDropTarget(date: Date) {
    const drag = this.scheduler?.appointmentDrag();

    return !!drag && date >= startOfDay(drag.start) && date <= drag.end;
  }

  /**
   * Moves an appointment to another day cell, keeping its time of day and its duration - the month
   * works in whole days, so a badge has no edge to resize by. Touch arms on a long press, same as
   * drawing a range does; see `startSchedulerDragGesture`.
   */
  protected startAppointmentDrag(event: PointerEvent, target: { appointment: Appointment; weeks: HTMLElement }) {
    // a press on a badge must not also draw a fresh range across the cells underneath it
    event.stopPropagation();

    const scheduler = this.scheduler;

    if (!scheduler || !this.canDragAppointments() || event.button !== 0) return;

    const { appointment, weeks } = target;
    const grab = this.dateAt(weeks, event);

    if (!grab) return;

    this.hasDragged = false;

    startSchedulerDragGesture({
      event,
      element: weeks,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX, clientY) => {
        this.hasDragged = true;

        if (!scheduler.appointmentDrag()) scheduler.beginAppointmentDrag(appointment, 'move');

        const to = this.dateAt(weeks, { clientX, clientY });

        // dragged off the grid: leave it on the last cell it was over rather than snapping home
        if (!to) return;

        const days = differenceInCalendarDays(to, grab);

        scheduler.updateAppointmentDrag(addDays(appointment.start, days), addDays(appointment.end, days));
      },
      settle: () => scheduler.commitAppointmentDrag(),
      cancel: () => scheduler.clearAppointmentDrag(),
    });
  }

  /**
   * Drags an all-day appointment's day span across the month grid. Whole days, so the range covers
   * every cell between the one pressed and the one under the pointer, in either direction.
   */
  protected startDraftRange(event: PointerEvent, weeks: HTMLElement) {
    const scheduler = this.scheduler;

    if (!scheduler || event.button !== 0) return;

    const anchor = this.dateAt(weeks, event);

    if (!anchor) return;

    startSchedulerDragGesture({
      event,
      element: weeks,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX, clientY) => {
        const to = this.dateAt(weeks, { clientX, clientY }) ?? anchor;
        const [from, until] = to < anchor ? [to, anchor] : [anchor, to];

        scheduler.setDraftRange({ start: startOfDay(from), end: endOfDay(until), allDay: true });
      },
      settle: () => {
        const draft = scheduler.draftRange();

        // a click made while a surface is open is dismissing it, not asking for another appointment
        if (!draft && !scheduler.selectedAppointmentId()) {
          scheduler.setDraftRange({ start: startOfDay(anchor), end: endOfDay(anchor), allDay: true });
        } else if (draft?.phase !== 'dragging') {
          return;
        }

        scheduler.surfaceAnchor.set(this.coverDraftRange(weeks));
        scheduler.commitDraftRange();
      },
      cancel: () => scheduler.clearDraftRange(),
    });
  }

  private coverDraftRange(weeks: HTMLElement): HTMLElement | null {
    const anchor = this.draftAnchor()?.nativeElement;
    const rows = this.month.weeks();
    // only the first week row the range touches: a range that wraps spans every column, so covering
    // all of it would center the surface on the grid rather than on what was drawn
    const rowIndex = rows.findIndex((week) => week.some((cell) => this.isDrafted(cell.date)));
    const row = rows[rowIndex];

    if (!anchor || !row) return null;

    const offset = rows.slice(0, rowIndex).reduce((count, week) => count + week.length, 0);
    const drafted = row
      .map((cell, index) => (this.isDrafted(cell.date) ? this.cells()[offset + index]?.nativeElement : null))
      .filter((element) => !!element)
      .map((element) => element.getBoundingClientRect());

    if (!drafted.length) return null;

    const host = weeks.getBoundingClientRect();
    const left = Math.min(...drafted.map((rect) => rect.left));
    const top = Math.min(...drafted.map((rect) => rect.top));

    this.renderer.setStyle(anchor, {
      left: `${left - host.left}px`,
      top: `${top - host.top}px`,
      width: `${Math.max(...drafted.map((rect) => rect.right)) - left}px`,
      height: `${Math.max(...drafted.map((rect) => rect.bottom)) - top}px`,
    });

    return anchor;
  }

  /**
   * The day cell under a pointer position. Columns are a uniform seventh of the row, but week rows
   * grow with their busiest cell, so the row is found by hit-testing the rendered rows rather than
   * dividing the grid's height.
   */
  private dateAt(weeks: HTMLElement, at: { clientX: number; clientY: number }): Date | null {
    const rows = this.weekRows();
    const weekIndex = rows.findIndex((row) => {
      const { top, bottom } = row.nativeElement.getBoundingClientRect();

      return at.clientY >= top && at.clientY <= bottom;
    });

    const week = this.month.weeks()[weekIndex];

    if (!week) return null;

    const { left, width } = weeks.getBoundingClientRect();
    const column = Math.min(Math.max(Math.floor(((at.clientX - left) / width) * 7), 0), 6);

    return week[column]?.date ?? null;
  }
}
