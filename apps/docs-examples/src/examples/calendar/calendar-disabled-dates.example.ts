import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';
import { addDays, startOfDay } from 'date-fns';

const weekdaysOnly = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6;

@Component({
  selector: 'app-calendar-disabled-dates-example',
  template: `
    <et-calendar [(value)]="value" [min]="min" [max]="max" [dateFilter]="WEEKDAYS_ONLY" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarDisabledDatesExampleComponent {
  protected value = signal<Date | null>(null);

  protected min = startOfDay(addDays(new Date(), -7));
  protected max = startOfDay(addDays(new Date(), 60));

  protected readonly WEEKDAYS_ONLY = weekdaysOnly;
}
