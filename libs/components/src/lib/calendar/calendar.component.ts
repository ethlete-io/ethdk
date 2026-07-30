import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { IconButtonComponent } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';
import { injectCalendarLabels } from '../calendar/calendar-labels';

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
  private calendarLabels = injectCalendarLabels();

  protected calendar = inject(CalendarDirective);

  public previousMonthLabel = input<string | null>(null);
  public nextMonthLabel = input<string | null>(null);

  /** The string in effect: this instance's `previousMonthLabel`, else the domain's label set. */
  protected resolvedPreviousMonthLabel = computed(
    () => this.previousMonthLabel() ?? this.calendarLabels().previousMonth,
  );

  /** The string in effect: this instance's `nextMonthLabel`, else the domain's label set. */
  protected resolvedNextMonthLabel = computed(() => this.nextMonthLabel() ?? this.calendarLabels().nextMonth);
}
