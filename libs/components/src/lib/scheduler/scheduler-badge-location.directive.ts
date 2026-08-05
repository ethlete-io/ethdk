import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerBadgeLocationComponent } from './scheduler-badge-location.component';

/** Options for {@link SchedulerBadgeLocationDirective}. */
export type SchedulerBadgeLocationConfig = SchedulerFeatureConfig;

/**
 * Built-in badge adornment: the appointment's `location`, with a pin icon - hidden when unset.
 * One of the default pieces `<et-scheduler>` bundles - see `registerBadgeAdornment`.
 *
 * @example
 * <et-scheduler [etSchedulerBadgeLocation]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerBadgeLocation]',
  exportAs: 'etSchedulerBadgeLocation',
})
export class SchedulerBadgeLocationDirective {
  private host = injectSchedulerFeatureHost('etSchedulerBadgeLocation');

  /** See {@link SchedulerBadgeLocationConfig}. */
  public config = input({} as SchedulerBadgeLocationConfig, {
    alias: 'etSchedulerBadgeLocation',
    transform: schedulerFeatureConfig<SchedulerBadgeLocationConfig>,
  });

  constructor() {
    this.host.registerBadgeAdornment({
      component: SchedulerBadgeLocationComponent,
      injector: inject(Injector),
      order: 20,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
