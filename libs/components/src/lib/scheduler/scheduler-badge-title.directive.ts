import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerBadgeTitleComponent } from './scheduler-badge-title.component';

/** Options for {@link SchedulerBadgeTitleDirective}. */
export type SchedulerBadgeTitleConfig = SchedulerFeatureConfig;

/**
 * Built-in badge adornment: the appointment's title. One of the default pieces `<et-scheduler>`
 * bundles - see `registerBadgeAdornment`.
 *
 * @example
 * <et-scheduler [etSchedulerBadgeTitle]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerBadgeTitle]',
  exportAs: 'etSchedulerBadgeTitle',
})
export class SchedulerBadgeTitleDirective {
  private host = injectSchedulerFeatureHost('etSchedulerBadgeTitle');

  /** See {@link SchedulerBadgeTitleConfig}. */
  public config = input({} as SchedulerBadgeTitleConfig, {
    alias: 'etSchedulerBadgeTitle',
    transform: schedulerFeatureConfig<SchedulerBadgeTitleConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SchedulerBadgeTitleComponent,
      injector: inject(Injector),
      order: 0,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
