import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The comparison-range bar under a cell, as a styles-only component mounted by `CalendarComponent`
 * whenever `comparisonStart` or `comparisonEnd` is set.
 *
 * @internal
 */
@Component({
  selector: 'et-calendar-comparison-band-styles',
  template: '',
  styleUrl: './calendar-comparison-band-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CalendarComparisonBandStylesComponent {}
