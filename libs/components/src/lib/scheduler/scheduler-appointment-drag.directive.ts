import { computed, Directive, effect, ElementRef, inject, input } from '@angular/core';
import { injectStyleManager, RuntimeError } from '@ethlete/core';
import { SchedulerDirective, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SchedulerAppointmentDragStylesComponent } from './scheduler-appointment-drag-styles.component';
import { SCHEDULER_ERROR_CODES } from './scheduler-errors';

/** Options for {@link SchedulerAppointmentDragDirective}. */
export type SchedulerAppointmentDragConfig = SchedulerFeatureConfig;

/**
 * Lets appointments already on the calendar be dragged to another time: moved on the month, week and
 * day views, and resized by their edges on the week and day views. A completed drag emits
 * `appointmentReschedule` rather than writing anything - `appointments` stays yours.
 *
 * One of the default pieces `<et-scheduler>` bundles; add it to a bare `[etScheduler]` composition
 * to give its views the same gesture.
 *
 * @example
 * <et-scheduler [etSchedulerAppointmentDrag]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerAppointmentDrag]',
  exportAs: 'etSchedulerAppointmentDrag',
})
export class SchedulerAppointmentDragDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private scheduler = inject(SchedulerDirective, { optional: true });
  private styleManager = injectStyleManager();

  /** See {@link SchedulerAppointmentDragConfig}. */
  public config = input({} as SchedulerAppointmentDragConfig, {
    alias: 'etSchedulerAppointmentDrag',
    transform: schedulerFeatureConfig<SchedulerAppointmentDragConfig>,
  });

  /** Whether the views should start a drag at all - what each of them checks on `pointerdown`. */
  public isEnabled = computed(() => this.config().enabled ?? true);

  constructor() {
    effect(() => {
      if (this.isEnabled()) {
        this.styleManager.mount(SchedulerAppointmentDragStylesComponent);
      }
    });

    if (!this.scheduler) {
      throw new RuntimeError(
        SCHEDULER_ERROR_CODES.APPOINTMENT_DRAG_OUTSIDE_SCHEDULER,
        '[etSchedulerAppointmentDrag] must be used on an <et-scheduler> or an [etScheduler] element.',
        { element: this.elementRef.nativeElement },
      );
    }
  }
}
