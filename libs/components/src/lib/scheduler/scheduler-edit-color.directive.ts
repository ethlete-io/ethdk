import { computed, Directive, inject, Injector, input } from '@angular/core';
import { injectSchedulerEditSurfaceHost, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerEditColorComponent } from './scheduler-edit-color.component';

/** Options for {@link SchedulerEditColorDirective}. */
export type SchedulerEditColorConfig = SchedulerFeatureConfig;

/**
 * Built-in edit-surface field: the appointment's `colorToken`. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerEditField`.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerEditColor]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerEditColor]',
  exportAs: 'etSchedulerEditColor',
})
export class SchedulerEditColorDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerEditColor');

  /** See {@link SchedulerEditColorConfig}. */
  public config = input({} as SchedulerEditColorConfig, {
    alias: 'etSchedulerEditColor',
    transform: schedulerFeatureConfig<SchedulerEditColorConfig>,
  });

  constructor() {
    this.host.registerEditField({
      component: SchedulerEditColorComponent,
      injector: inject(Injector),
      order: 40,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
