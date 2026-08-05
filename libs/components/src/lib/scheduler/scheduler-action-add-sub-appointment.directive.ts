import { computed, Directive, inject, input } from '@angular/core';
import {
  injectSchedulerEditSurfaceHost,
  SchedulerEditSurfaceDirective,
  SchedulerFeatureConfig,
  schedulerFeatureConfig,
} from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/** Options for {@link SchedulerActionAddSubAppointmentDirective}. */
export type SchedulerActionAddSubAppointmentConfig = SchedulerFeatureConfig;

/**
 * Built-in appointment action: starts adding a sub-appointment of the surface's current
 * appointment - see `SchedulerEditSurfaceDirective.startAddSubAppointment`. One of the default
 * pieces `<et-scheduler-edit-surface>` bundles - see `registerAppointmentAction`.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerActionAddSubAppointment]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerActionAddSubAppointment]',
  exportAs: 'etSchedulerActionAddSubAppointment',
})
export class SchedulerActionAddSubAppointmentDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerActionAddSubAppointment');
  private surface = inject(SchedulerEditSurfaceDirective);
  private labels = injectSchedulerLabels();

  /** See {@link SchedulerActionAddSubAppointmentConfig}. */
  public config = input({} as SchedulerActionAddSubAppointmentConfig, {
    alias: 'etSchedulerActionAddSubAppointment',
    transform: schedulerFeatureConfig<SchedulerActionAddSubAppointmentConfig>,
  });

  constructor() {
    this.host.registerAppointmentAction({
      label: computed(() => this.labels().addSubAppointment),
      icon: 'et-plus',
      order: 0,
      enabled: computed(() => this.config().enabled ?? true),
      run: () => this.surface.startAddSubAppointment(),
    });
  }
}
