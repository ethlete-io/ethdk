import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerBadgeChainCountComponent } from './scheduler-badge-chain-count.component';

/** Options for {@link SchedulerBadgeChainCountDirective}. */
export type SchedulerBadgeChainCountConfig = SchedulerFeatureConfig;

/**
 * Built-in badge adornment: a chevron and the appointment's total descendant count (every depth) -
 * hidden for an appointment with no sub-appointments. One of the default pieces `<et-scheduler>`
 * bundles - see `registerBadgeAdornment`.
 *
 * @example
 * <et-scheduler [etSchedulerBadgeChainCount]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerBadgeChainCount]',
  exportAs: 'etSchedulerBadgeChainCount',
})
export class SchedulerBadgeChainCountDirective {
  private host = injectSchedulerFeatureHost('etSchedulerBadgeChainCount');

  /** See {@link SchedulerBadgeChainCountConfig}. */
  public config = input({} as SchedulerBadgeChainCountConfig, {
    alias: 'etSchedulerBadgeChainCount',
    transform: schedulerFeatureConfig<SchedulerBadgeChainCountConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SchedulerBadgeChainCountComponent,
      injector: inject(Injector),
      order: 30,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
