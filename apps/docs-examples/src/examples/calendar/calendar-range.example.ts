import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarRange } from '@ethlete/components';

@Component({
  selector: 'app-calendar-range-example',
  template: `
    <et-calendar [(rangeValue)]="range" mode="range" />

    <p>Range: {{ range().start?.toDateString() ?? 'null' }} → {{ range().end?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarRangeExampleComponent {
  protected range = signal<CalendarRange>({ start: null, end: null });
}
