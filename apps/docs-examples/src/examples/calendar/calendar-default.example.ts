import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-default-example',
  template: `
    <et-calendar [(value)]="value" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarDefaultExampleComponent {
  protected value = signal<Date | null>(null);
}
