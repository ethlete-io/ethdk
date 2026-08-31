import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The time grid's drag affordances - `.et-scheduler-time-grid-block`'s draggable/dragging states
 * and the block/all-day resize handles - as a styles-only component mounted by
 * `SchedulerAppointmentDragDirective`. See `ButtonStylesDirective` for the pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-appointment-drag-styles',
  template: '',
  styleUrl: './scheduler-appointment-drag-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SchedulerAppointmentDragStylesComponent {}
