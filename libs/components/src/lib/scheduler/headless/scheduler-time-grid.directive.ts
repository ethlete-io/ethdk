import { Directive, afterNextRender, computed, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { eachDayOfInterval } from 'date-fns';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { buildSchedulerTimeGrid } from './internals/scheduler-time-grid';
import { SchedulerDirective } from './scheduler.directive';

export type { SchedulerTimeGridBlock, SchedulerTimeGridDay } from './internals/scheduler-time-grid';

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
  private readonly hostElement = injectHostElement();

  private scheduler = inject(SchedulerDirective, { optional: true });

  /** One day column per day of the visible range, laid out by `buildSchedulerTimeGrid`. */
  public days = computed(() => {
    const scheduler = this.scheduler;

    if (!scheduler) {
      return [];
    }

    return buildSchedulerTimeGrid({
      days: eachDayOfInterval(scheduler.visibleRange()),
      tree: scheduler.appointmentTree(),
      today: new Date(),
    });
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
