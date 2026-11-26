import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-calendar-multiple-example',
  template: `
    <et-calendar [(multipleValue)]="dates" mode="multiple" />

    <p>Picked ({{ dates().length }}): {{ label() }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
})
export class CalendarMultipleExampleComponent {
  protected dates = signal<Date[]>([]);

  protected label = computed(
    () =>
      this.dates()
        .map((date) => date.toDateString())
        .join(' · ') || 'none',
  );
}
