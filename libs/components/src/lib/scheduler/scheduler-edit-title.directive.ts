import { computed, Directive, inject, Injector, input } from '@angular/core';
import {
  injectSchedulerEditSurfaceHost,
  SchedulerEditSurfaceDirective,
  SchedulerFeatureConfig,
  schedulerFeatureConfig,
} from './headless';
import { SchedulerEditTitleComponent } from './scheduler-edit-title.component';

/** Options for {@link SchedulerEditTitleDirective}. */
export type SchedulerEditTitleConfig = SchedulerFeatureConfig;

/**
 * Built-in edit-surface field: the appointment's title. One of the default pieces
 * `<et-scheduler-edit-surface>` bundles - see `registerEditField`. Required - the field is
 * invalid while the draft's title is blank, which gates the surface's save button.
 *
 * @example
 * <et-scheduler-edit-surface [etSchedulerEditTitle]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerEditTitle]',
  exportAs: 'etSchedulerEditTitle',
})
export class SchedulerEditTitleDirective {
  private host = injectSchedulerEditSurfaceHost('etSchedulerEditTitle');
  private surface = inject(SchedulerEditSurfaceDirective);

  /** See {@link SchedulerEditTitleConfig}. */
  public config = input({} as SchedulerEditTitleConfig, {
    alias: 'etSchedulerEditTitle',
    transform: schedulerFeatureConfig<SchedulerEditTitleConfig>,
  });

  constructor() {
    this.host.registerEditField({
      component: SchedulerEditTitleComponent,
      injector: inject(Injector),
      order: 0,
      enabled: computed(() => this.config().enabled ?? true),
      valid: computed(() => this.surface.draft().title.trim().length > 0),
    });
  }
}
