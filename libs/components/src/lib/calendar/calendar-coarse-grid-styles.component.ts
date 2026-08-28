import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The month and year grids' own sizing and the row-centering they share, as a styles-only component
 * mounted by `CalendarComponent` whenever a coarser view than the day grid is reachable.
 *
 * @internal
 */
@Component({
  selector: 'et-calendar-coarse-grid-styles',
  template: '',
  styleUrl: './calendar-coarse-grid-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CalendarCoarseGridStylesComponent {}
