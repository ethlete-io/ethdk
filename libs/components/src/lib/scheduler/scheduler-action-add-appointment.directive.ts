import { computed, Directive, input } from '@angular/core';
import { injectSchedulerFeatureHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/** Options for {@link SchedulerActionAddAppointmentDirective}. */
export type SchedulerActionAddAppointmentConfig = SchedulerFeatureConfig;

/**
 * Built-in toolbar action: opens the registered edit surface for a brand-new, blank top-level
 * appointment - see `SchedulerFeatureHost.addAppointment`. One of the default pieces
 * `<et-scheduler>` bundles - see `registerToolbarAction`. Left out of the toolbar when no
 * `provideSchedulerEditSurface()` is in scope; a bare `[etScheduler]` opens one itself with
 * `injectSchedulerEditSurfaceOpener().openAdd(...)`.
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

  public config = input({} as SchedulerActionAddAppointmentConfig, {
    alias: 'etSchedulerActionAddAppointment',
    transform: schedulerFeatureConfig<SchedulerActionAddAppointmentConfig>,
  });

  constructor() {
    this.host.registerToolbarAction({
      label: computed(() => this.labels().addAppointment),
      icon: 'et-plus',
      order: 0,
      enabled: computed(() => (this.host.canAddAppointment?.() ?? true) && (this.config().enabled ?? true)),
      run: () => this.host.addAppointment(),
    });
  }
}
