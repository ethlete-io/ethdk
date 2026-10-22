import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarRange, createWeekRangeStrategy } from '@ethlete/components';

@Component({
  selector: 'app-calendar-week-range-example',
  template: `
    <et-calendar [(rangeValue)]="range" [rangeSelectionStrategy]="strategy" mode="range" />

    <p>Range: {{ range().start?.toDateString() ?? 'null' }} → {{ range().end?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarWeekRangeExampleComponent {
  protected range = signal<CalendarRange>({ start: null, end: null });

  protected strategy = createWeekRangeStrategy();
}
