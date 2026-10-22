import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';
import { addMonths, startOfMonth } from 'date-fns';

@Component({
  selector: 'app-calendar-start-at-example',
  template: `
    <et-calendar [(value)]="value" [startAt]="startAt" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarStartAtExampleComponent {
  protected value = signal<Date | null>(null);
  protected startAt = startOfMonth(addMonths(new Date(), 2));
}
