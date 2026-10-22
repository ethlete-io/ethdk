import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarRange } from '@ethlete/components';

@Component({
  selector: 'app-calendar-two-months-example',
  template: `
    <et-calendar [(rangeValue)]="range" [monthsShown]="2" mode="range" />

    <p>Range: {{ range().start?.toDateString() ?? 'null' }} → {{ range().end?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarTwoMonthsExampleComponent {
  protected range = signal<CalendarRange>({ start: null, end: null });
}
