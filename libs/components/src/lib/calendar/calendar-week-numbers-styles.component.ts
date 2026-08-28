import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The week-number column's width contribution and its cells' chrome, as a styles-only component
 * mounted by `CalendarComponent` whenever `weekNumbers` is on.
 *
 * @internal
 */
@Component({
  selector: 'et-calendar-week-numbers-styles',
  template: '',
  styleUrl: './calendar-week-numbers-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CalendarWeekNumbersStylesComponent {}
