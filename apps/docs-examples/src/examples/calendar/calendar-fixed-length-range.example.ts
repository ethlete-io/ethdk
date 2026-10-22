import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarRange, createFixedLengthRangeStrategy } from '@ethlete/components';

@Component({
  selector: 'app-calendar-fixed-length-range-example',
  template: `
    <et-calendar [(rangeValue)]="range" [rangeSelectionStrategy]="strategy" mode="range" />

    <p>Range: {{ range().start?.toDateString() ?? 'null' }} → {{ range().end?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarFixedLengthRangeExampleComponent {
  protected range = signal<CalendarRange>({ start: null, end: null });

  protected strategy = createFixedLengthRangeStrategy({ days: 7 });
}
