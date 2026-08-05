import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerEditSurfaceHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerEditLocationComponent } from './scheduler-edit-location.component';

/** Options for {@link SchedulerEditLocationDirective}. */
export type SchedulerEditLocationConfig = SchedulerFeatureConfig;

/**
 * Built-in edit-surface field: the appointment's `location`. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerEditField`.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerEditLocation]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerEditLocation]',
  exportAs: 'etSchedulerEditLocation',
})
export class SchedulerEditLocationDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerEditLocation');

  /** See {@link SchedulerEditLocationConfig}. */
  public config = input({} as SchedulerEditLocationConfig, {
    alias: 'etSchedulerEditLocation',
    transform: schedulerFeatureConfig<SchedulerEditLocationConfig>,
  });

  constructor() {
    this.host.registerEditField({
      component: SchedulerEditLocationComponent,
      injector: inject(Injector),
      order: 20,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
