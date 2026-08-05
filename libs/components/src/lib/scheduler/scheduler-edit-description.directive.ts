import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerEditSurfaceHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerEditDescriptionComponent } from './scheduler-edit-description.component';

/** Options for {@link SchedulerEditDescriptionDirective}. */
export type SchedulerEditDescriptionConfig = SchedulerFeatureConfig;

/**
 * Built-in edit-surface field: the appointment's `description`. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerEditField`.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerEditDescription]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerEditDescription]',
  exportAs: 'etSchedulerEditDescription',
})
export class SchedulerEditDescriptionDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerEditDescription');

  /** See {@link SchedulerEditDescriptionConfig}. */
  public config = input({} as SchedulerEditDescriptionConfig, {
    alias: 'etSchedulerEditDescription',
    transform: schedulerFeatureConfig<SchedulerEditDescriptionConfig>,
  });

  constructor() {
    this.host.registerEditField({
      component: SchedulerEditDescriptionComponent,
      injector: inject(Injector),
      order: 30,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
