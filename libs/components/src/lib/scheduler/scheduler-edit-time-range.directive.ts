import { computed, Directive, inject, Injector, input } from '@angular/core';
import {
  injectSchedulerEditSurfaceHost,
  SchedulerEditSurfaceDirective,
  SchedulerFeatureConfig,
  schedulerFeatureConfig,
} from './headless';
import { SchedulerEditTimeRangeComponent } from './scheduler-edit-time-range.component';

/** Options for {@link SchedulerEditTimeRangeDirective}. */
export type SchedulerEditTimeRangeConfig = SchedulerFeatureConfig;

/**
 * Built-in edit-surface field: the appointment's `start`/`end`. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerEditField`. Invalid while `end` is before
 * `start`, which gates the surface's save button.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerEditTimeRange]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerEditTimeRange]',
  exportAs: 'etSchedulerEditTimeRange',
})
export class SchedulerEditTimeRangeDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerEditTimeRange');
  private surface = inject(SchedulerEditSurfaceDirective);

  /** See {@link SchedulerEditTimeRangeConfig}. */
  public config = input({} as SchedulerEditTimeRangeConfig, {
    alias: 'etSchedulerEditTimeRange',
    transform: schedulerFeatureConfig<SchedulerEditTimeRangeConfig>,
  });

  constructor() {
    this.host.registerEditField({
      component: SchedulerEditTimeRangeComponent,
      injector: inject(Injector),
      order: 10,
      enabled: computed(() => this.config().enabled ?? true),
      valid: computed(() => this.surface.draft().end >= this.surface.draft().start),
    });
  }
}
