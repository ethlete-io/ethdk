import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerBadgeTimeRangeComponent } from './scheduler-badge-time-range.component';

/** Options for {@link SchedulerBadgeTimeRangeDirective}. */
export type SchedulerBadgeTimeRangeConfig = SchedulerFeatureConfig;

/**
 * Built-in badge adornment: the appointment's `start`–`end` time, hidden for an all-day
 * appointment. One of the default pieces `<et-scheduler>` bundles - see `registerBadgeAdornment`.
 *
 * @example
 * <et-scheduler [etSchedulerBadgeTimeRange]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerBadgeTimeRange]',
  exportAs: 'etSchedulerBadgeTimeRange',
})
export class SchedulerBadgeTimeRangeDirective {
  private host = injectSchedulerFeatureHost('etSchedulerBadgeTimeRange');

  /** See {@link SchedulerBadgeTimeRangeConfig}. */
  public config = input({} as SchedulerBadgeTimeRangeConfig, {
    alias: 'etSchedulerBadgeTimeRange',
    transform: schedulerFeatureConfig<SchedulerBadgeTimeRangeConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SchedulerBadgeTimeRangeComponent,
      injector: inject(Injector),
      order: 10,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
