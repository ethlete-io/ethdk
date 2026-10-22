import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarRange } from '@ethlete/components';
import { startOfDay } from 'date-fns';

@Component({
  selector: 'app-calendar-comparison-range-example',
  template: `
    <et-calendar
      [(rangeValue)]="range"
      [comparisonStart]="previous.start"
      [comparisonEnd]="previous.end"
      mode="range"
    />

    <p>Range: {{ range().start?.toDateString() ?? 'null' }} → {{ range().end?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarComparisonRangeExampleComponent {
  protected range = signal<CalendarRange>({ start: null, end: null });

  protected previous = { start: startOfDay(new Date(2026, 6, 3)), end: startOfDay(new Date(2026, 6, 9)) };
}
