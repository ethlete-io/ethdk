import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The `.et-scheduler-appointment` badge rule, as a styles-only component mounted by every
 * scheduler view that renders a plain (non-time-grid) appointment badge - see
 * `ButtonStylesDirective` for the pattern. Shared here rather than duplicated per view, since a
 * consumer using only one view should still get exactly one copy of it.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-appointment-styles',
  template: '',
  styleUrl: './scheduler-appointment-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SchedulerAppointmentStylesComponent {}
