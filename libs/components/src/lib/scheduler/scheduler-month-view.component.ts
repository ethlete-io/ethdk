import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewEncapsulation, inject, viewChildren } from '@angular/core';
import { ProvideColorDirective, injectRenderer, injectStyleManager } from '@ethlete/core';
import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { MENU_IMPORTS } from '../menu';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerMonthDirective } from './headless';
import { startSchedulerDraftGesture } from './headless/internals/scheduler-draft-gesture';
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
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected month = inject(SchedulerMonthDirective);
  protected labels = injectSchedulerLabels();

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();
  private weekRows = viewChildren<ElementRef<HTMLElement>>('weekRow');
  private cells = viewChildren<ElementRef<HTMLElement>>('cell');

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
    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }

  protected isDrafted(date: Date) {
    const draft = this.scheduler?.draftRange();

    return !!draft && date >= startOfDay(draft.start) && date <= draft.end;
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

    startSchedulerDraftGesture({
      event,
      element: weeks,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      draw: (clientX, clientY) => {
        const to = this.dateAt(weeks, { clientX, clientY }) ?? anchor;
        const [from, until] = to < anchor ? [to, anchor] : [anchor, to];

        scheduler.setDraftRange({ start: startOfDay(from), end: endOfDay(until), allDay: true });
      },
      settle: () => {
        const draft = scheduler.draftRange();

        if (!draft) return;

        // anchor on the cell the range starts in, so the surface opens over its own first day
        const index = this.month
          .weeks()
          .flat()
          .findIndex((cell) => isSameDay(cell.date, draft.start));

        scheduler.surfaceAnchor.set(this.cells()[index]?.nativeElement ?? null);
        scheduler.commitDraftRange();
      },
      cancel: () => scheduler.clearDraftRange(),
    });
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
