import { Directive, afterNextRender, computed, inject, input, numberAttribute } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { buildSchedulerMonthGrid } from './internals/scheduler-month';
import { SchedulerDirective } from './scheduler.directive';

export type { SchedulerMonthDayCell } from './internals/scheduler-month';

/**
 * Buckets the host `[etScheduler]`'s appointments into a month grid: one day cell per day of the
 * padded month, each capped to {@link maxVisiblePerCell} appointments so the view can render a
 * "+N more" affordance for the rest. Pure layout - no template structure, see
 * `SchedulerMonthViewComponent` for the default rendering.
 */
@Directive({
  selector: '[etSchedulerMonth]',
  exportAs: 'etSchedulerMonth',
})
export class SchedulerMonthDirective {
  private scheduler = inject(SchedulerDirective, { optional: true });

  /** How many appointments a day cell shows before the rest collapse into an overflow count. */
  public maxVisiblePerCell = input(3, { transform: numberAttribute });

  /** Full weeks covering the focused month, padded with the adjacent months' leading/trailing days. */
  public weeks = computed(() => {
    const scheduler = this.scheduler;

    if (!scheduler) {
      return [];
    }

    return buildSchedulerMonthGrid({
      focusedDate: scheduler.focusedDate(),
      weekStartsOn: scheduler.effectiveFirstDayOfWeek(),
      tree: scheduler.appointmentTree(),
      maxVisiblePerCell: this.maxVisiblePerCell(),
      today: new Date(),
    });
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scheduler) {
          throw new RuntimeError(
            SCHEDULER_ERROR_CODES.VIEW_OUTSIDE_SCHEDULER,
            '[etSchedulerMonth] must be placed inside an [etScheduler].',
          );
        }
      });
    }
  }
}
