import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-month-precision-example',
  template: `
    <et-calendar [(value)]="value" precision="month" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarMonthPrecisionExampleComponent {
  protected value = signal<Date | null>(null);
}
