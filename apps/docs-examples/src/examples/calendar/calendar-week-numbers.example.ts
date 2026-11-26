import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-week-numbers-example',
  template: `
    <et-calendar [(value)]="value" weekNumbers />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarWeekNumbersExampleComponent {
  protected value = signal<Date | null>(null);
}
