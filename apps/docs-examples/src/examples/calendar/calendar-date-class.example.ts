import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CALENDAR_IMPORTS, CalendarDateClassFn } from '@ethlete/components';

const dateClass: CalendarDateClassFn = (date, view) => {
  if (view !== 'month') {
    return null;
  }

  if (date.getDate() === 1) {
    return 'app-holiday';
  }

  return date.getDate() === 13 ? 'app-busy' : null;
};

@Component({
  selector: 'app-calendar-date-class-example',
  template: `
    <et-calendar [(value)]="value" [dateClass]="DATE_CLASS" />

    <p>Value: {{ value()?.toDateString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CALENDAR_IMPORTS],
  styles: `
    .app-busy .et-calendar-cell-content {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--et-theme-color-primary-solid) 60%, transparent);
    }

    .app-holiday .et-calendar-cell-content {
      background: color-mix(in srgb, var(--et-theme-color-primary-solid) 18%, transparent);
      font-weight: 600;
    }
  `,
})
export class CalendarDateClassExampleComponent {
  protected value = signal<Date | null>(null);

  protected readonly DATE_CLASS = dateClass;
}
