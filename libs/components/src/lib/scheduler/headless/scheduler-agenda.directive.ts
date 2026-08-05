import { Directive, afterNextRender, computed, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { eachDayOfInterval } from 'date-fns';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { buildSchedulerAgenda } from './internals/scheduler-agenda';
import { SchedulerDirective } from './scheduler.directive';

export type { SchedulerAgendaDay } from './internals/scheduler-agenda';

/**
 * Groups the host `[etScheduler]`'s appointments into an agenda list: one entry per day of the
 * visible range, each holding the appointments that touch it in chain order. Pure layout - no
 * template structure, see `SchedulerAgendaViewComponent` for the default rendering.
 */
@Directive({
  selector: '[etSchedulerAgenda]',
  exportAs: 'etSchedulerAgenda',
})
export class SchedulerAgendaDirective {
  private readonly hostElement = injectHostElement();

  private scheduler = inject(SchedulerDirective, { optional: true });

  /** One entry per day of the visible range, laid out by `buildSchedulerAgenda`. */
  public days = computed(() => {
    const scheduler = this.scheduler;

    if (!scheduler) {
      return [];
    }

    return buildSchedulerAgenda({
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
            '[etSchedulerAgenda] must be placed inside an [etScheduler].',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
