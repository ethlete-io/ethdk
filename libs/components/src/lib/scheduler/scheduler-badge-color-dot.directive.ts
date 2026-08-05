import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerBadgeColorDotComponent } from './scheduler-badge-color-dot.component';

/** Options for {@link SchedulerBadgeColorDotDirective}. */
export type SchedulerBadgeColorDotConfig = SchedulerFeatureConfig;

/**
 * Built-in badge adornment: the small dot in the appointment's own color, ahead of its title. One
 * of the default pieces `<et-scheduler>` bundles - see `registerBadgeAdornment`.
 *
 * @example
 * <et-scheduler [etSchedulerBadgeColorDot]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerBadgeColorDot]',
  exportAs: 'etSchedulerBadgeColorDot',
})
export class SchedulerBadgeColorDotDirective {
  private host = injectSchedulerFeatureHost('etSchedulerBadgeColorDot');

  /** See {@link SchedulerBadgeColorDotConfig}. */
  public config = input({} as SchedulerBadgeColorDotConfig, {
    alias: 'etSchedulerBadgeColorDot',
    transform: schedulerFeatureConfig<SchedulerBadgeColorDotConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SchedulerBadgeColorDotComponent,
      injector: inject(Injector),
      order: -10,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
