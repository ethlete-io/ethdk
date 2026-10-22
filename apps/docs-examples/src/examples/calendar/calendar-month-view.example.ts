import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-month-view-example',
  template: `
    <et-calendar [(value)]="value" startView="year" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarMonthViewExampleComponent {
  protected value = signal<Date | null>(null);
}
