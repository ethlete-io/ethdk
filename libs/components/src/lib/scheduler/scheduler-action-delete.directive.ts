import { computed, Directive, inject, input } from '@angular/core';
import {
  injectSchedulerEditSurfaceHost,
  SchedulerEditSurfaceDirective,
  SchedulerFeatureConfig,
  schedulerFeatureConfig,
} from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/** Options for {@link SchedulerActionDeleteDirective}. */
export type SchedulerActionDeleteConfig = SchedulerFeatureConfig;

/**
 * Built-in appointment action: deletes the surface's current appointment together with every
 * descendant - see `SchedulerEditSurfaceDirective.requestDelete`. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerAppointmentAction`.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerActionDelete]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerActionDelete]',
  exportAs: 'etSchedulerActionDelete',
})
export class SchedulerActionDeleteDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerActionDelete');
  private surface = inject(SchedulerEditSurfaceDirective);
  private labels = injectSchedulerLabels();

  /** See {@link SchedulerActionDeleteConfig}. */
  public config = input({} as SchedulerActionDeleteConfig, {
    alias: 'etSchedulerActionDelete',
    transform: schedulerFeatureConfig<SchedulerActionDeleteConfig>,
  });

  constructor() {
    this.host.registerAppointmentAction({
      label: computed(() => this.labels().deleteWithDescendants),
      icon: 'et-trash',
      order: 100,
      destructive: true,
      enabled: computed(() => this.config().enabled ?? true),
      run: () => this.surface.requestDelete(),
    });
  }
}
