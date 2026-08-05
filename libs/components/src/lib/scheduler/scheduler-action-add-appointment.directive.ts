import { computed, Directive, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/** Options for {@link SchedulerActionAddAppointmentDirective}. */
export type SchedulerActionAddAppointmentConfig = SchedulerFeatureConfig;

/**
 * Built-in toolbar action: opens the default edit surface for a brand-new, blank top-level
 * appointment - see `SchedulerFeatureHost.addAppointment`. One of the default pieces
 * `<et-scheduler>` bundles - see `registerToolbarAction`. Depends on the default edit surface
 * (it's what the dialog it opens is), so unlike `etSchedulerActionAddSubAppointment` it has no
 * bare-`[etScheduler]` equivalent - a headless-only composition needs its own "new appointment"
 * affordance.
 *
 * @example
 * <et-scheduler [etSchedulerActionAddAppointment]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerActionAddAppointment]',
  exportAs: 'etSchedulerActionAddAppointment',
})
export class SchedulerActionAddAppointmentDirective {
  private host = injectSchedulerFeatureHost('etSchedulerActionAddAppointment');
  private labels = injectSchedulerLabels();

  /** See {@link SchedulerActionAddAppointmentConfig}. */
  public config = input({} as SchedulerActionAddAppointmentConfig, {
    alias: 'etSchedulerActionAddAppointment',
    transform: schedulerFeatureConfig<SchedulerActionAddAppointmentConfig>,
  });

  constructor() {
    this.host.registerToolbarAction({
      label: computed(() => this.labels().addAppointment),
      icon: 'et-plus',
      order: 0,
      enabled: computed(() => this.config().enabled ?? true),
      run: () => this.host.addAppointment(),
    });
  }
}
