import { Directive, afterNextRender, computed, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { buildSchedulerTimeGrid, computeInitialScrollHour } from './internals/scheduler-time-grid';
import { SchedulerDirective } from './scheduler.directive';

export type {
  SchedulerTimeGridAllDayEntry,
  SchedulerTimeGridBlock,
  SchedulerTimeGridDay,
} from './internals/scheduler-time-grid';

/**
 * Lays the host `[etScheduler]`'s appointments onto an hour-axis time grid: one day column per day
 * of the visible range - a single day for the day view, seven for the week view, same directive,
 * only the range differs. Each column splits into an all-day strip and overlap-packed timed
 * blocks. Pure layout - no template structure, see `SchedulerTimeGridViewComponent` for the
 * default rendering.
 */
@Directive({
  selector: '[etSchedulerTimeGrid]',
  exportAs: 'etSchedulerTimeGrid',
})
export class SchedulerTimeGridDirective {
  private hostElement = injectHostElement();

  private scheduler = inject(SchedulerDirective, { optional: true });

  private grid = computed(() => {
    const scheduler = this.scheduler;

    if (!scheduler) {
      return { days: [], allDay: [], allDayRowCount: 0 };
    }

    return buildSchedulerTimeGrid({
      days: eachDayOfInterval(scheduler.visibleRange()),
      tree: scheduler.appointmentTree(),
      today: new Date(),
    });
  });

  /** One day column per day of the visible range. */
  public days = computed(() => this.grid().days);

  /** All-day appointments, each spanning the visible days it covers and stacked to avoid overlap. */
  public allDay = computed(() => this.grid().allDay);

  /** How many stacking rows {@link allDay} needs - sizes the all-day lane's reserved space. */
  public allDayRowCount = computed(() => this.grid().allDayRowCount);

  /**
   * Which hour the body's scrollable region should open scrolled to - the current hour when today
   * is visible, else the earliest appointment's hour, else a business-hours default. See
   * `SchedulerTimeGridViewComponent`, which reads this once on mount rather than reactively, so
   * navigating days/weeks afterwards never yanks the user's own scroll position back.
   */
  public initialScrollHour = computed(() => computeInitialScrollHour(this.grid(), new Date()));

  /**
   * The scheduler's drag-to-create range placed on this grid: which day column it belongs to, and
   * its `offset`/`span` as percentages of that column, the same units {@link days}' blocks use.
   * `null` when nothing is being dragged or the range sits outside the visible days.
   */
  public draftBlock = computed(() => {
    const draft = this.scheduler?.draftRange();

    if (!draft) return null;

    const dayIndex = this.days().findIndex((day) => isSameDay(day.date, draft.start));

    if (dayIndex === -1) return null;

    const dayStart = startOfDay(draft.start).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const end = Math.min(draft.end.getTime(), dayStart + dayMs);

    return {
      dayIndex,
      offset: ((draft.start.getTime() - dayStart) / dayMs) * 100,
      span: ((end - draft.start.getTime()) / dayMs) * 100,
      phase: draft.phase,
    };
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scheduler) {
          throw new RuntimeError(
            SCHEDULER_ERROR_CODES.VIEW_OUTSIDE_SCHEDULER,
            '[etSchedulerTimeGrid] must be placed inside an [etScheduler].',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
