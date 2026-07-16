import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { IconButtonComponent } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';

@Component({
  selector: 'et-calendar',
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CalendarCellDirective, CalendarGridDirective, IconButtonComponent, IconDirective],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: CalendarDirective,
      inputs: ['mode', 'min', 'max', 'dateFilter', 'firstDayOfWeek', 'locale', 'value', 'rangeValue', 'activeMonth'],
      outputs: ['valueChange', 'rangeValueChange', 'activeMonthChange'],
    },
  ],
  host: {
    class: 'et-calendar',
  },
})
export class CalendarComponent {
  protected calendar = inject(CalendarDirective);

  public previousMonthLabel = input('Previous month');
  public nextMonthLabel = input('Next month');
}
