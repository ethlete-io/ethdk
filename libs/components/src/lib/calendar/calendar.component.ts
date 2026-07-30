import { booleanAttribute, Component, computed, contentChild, inject, input, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconButtonComponent } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';
import { injectCalendarLabels } from '../calendar/calendar-labels';
import { CalendarHeaderDirective } from './calendar-header.directive';

@Component({
  selector: 'et-calendar',
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CalendarCellDirective, CalendarGridDirective, IconButtonComponent, IconDirective, NgTemplateOutlet],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: CalendarDirective,
      inputs: [
        'mode',
        'min',
        'max',
        'dateFilter',
        'startAt',
        'monthsShown',
        'precision',
        'startView',
        'dateClass',
        'rangeSelectionStrategy',
        'comparisonStart',
        'comparisonEnd',
        'firstDayOfWeek',
        'locale',
        'value',
        'rangeValue',
        'multipleValue',
        'activeMonth',
      ],
      outputs: [
        'valueChange',
        'rangeValueChange',
        'multipleValueChange',
        'activeMonthChange',
        'monthSelect',
        'yearSelect',
      ],
    },
  ],
  host: {
    class: 'et-calendar',
    '[attr.data-view]': 'calendar.view()',
    '[attr.data-week-numbers]': "weekNumbers() ? '' : null",
    // the grid widths are CSS, and the count they have to agree on is state
    '[style.--_et-calendar-months]': 'calendar.monthsShown()',
  },
})
export class CalendarComponent {
  private calendarLabels = injectCalendarLabels();

  /**
   * The headless directive behind this calendar — everything `[etCalendar]` exposes, for chrome of
   * your own around or instead of the default header (`<et-calendar #cal>` then `cal.headless`).
   */
  public headless = inject(CalendarDirective);

  /**
   * Renders a leading column of week numbers in the day grid. The numbers themselves come from the
   * headless tier (`calendar.weekNumbers()`), which localizes them; this only decides to show them.
   */
  public weekNumbers = input(false, { transform: booleanAttribute });

  /** Only labels the nav buttons while the day grid is showing — the coarser views read the label set. */
  public previousMonthLabel = input<string | null>(null);
  public nextMonthLabel = input<string | null>(null);

  /** A projected header template, which replaces the default one. */
  protected headerTemplate = contentChild(CalendarHeaderDirective);

  protected calendar = this.headless;

  /** The step-back button's label for the view on show; this instance's `previousMonthLabel` wins in the day grid. */
  protected resolvedPreviousLabel = computed(() => {
    const labels = this.calendarLabels();

    switch (this.calendar.view()) {
      case 'year':
        return labels.previousYear;
      case 'multiYear':
        return labels.previousYearRange;
      default:
        return this.previousMonthLabel() ?? labels.previousMonth;
    }
  });

  /** The step-forward button's label for the view on show. */
  protected resolvedNextLabel = computed(() => {
    const labels = this.calendarLabels();

    switch (this.calendar.view()) {
      case 'year':
        return labels.nextYear;
      case 'multiYear':
        return labels.nextYearRange;
      default:
        return this.nextMonthLabel() ?? labels.nextMonth;
    }
  });

  /** Names the week-number column, and prefixes each row's own number. */
  protected weekLabel = computed(() => this.calendarLabels().week);

  /** The header button's label: where it takes the reader from the view on show. */
  protected resolvedZoomLabel = computed(() => {
    const labels = this.calendarLabels();

    switch (this.calendar.view()) {
      case 'year':
        return labels.switchToMultiYearView;
      case 'multiYear':
        return labels.switchToMonthView;
      default:
        return labels.switchToYearView;
    }
  });
}
