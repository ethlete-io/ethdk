import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { injectStyleManager, mountEasingTokens } from '@ethlete/core';
import { IconButtonComponent } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { CalendarCellDirective, CalendarDirective, CalendarGridDirective } from './headless';
import { injectCalendarLabels } from '../calendar/calendar-labels';
import { CalendarHeaderDirective } from './calendar-header.directive';
import { CalendarCoarseGridStylesComponent } from './calendar-coarse-grid-styles.component';
import { CalendarComparisonBandStylesComponent } from './calendar-comparison-band-styles.component';
import { CalendarWeekNumbersStylesComponent } from './calendar-week-numbers-styles.component';

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
    '[style.--_et-calendar-months]': 'calendar.monthsShown()',
  },
})
export class CalendarComponent {
  private calendarLabels = injectCalendarLabels();
  private styleManager = injectStyleManager();

  /**
   * The headless directive behind this calendar - everything `[etCalendar]` exposes, for chrome of
   * your own around or instead of the default header (`<et-calendar #cal>` then `cal.headless`).
   */
  public headless = inject(CalendarDirective);

  /**
   * Renders a leading column of week numbers in the day grid. The numbers themselves come from the
   * headless tier (`calendar.weekNumbers()`), which localizes them; this only decides to show them.
   */
  public weekNumbers = input(false, { transform: booleanAttribute });

  /** Only labels the nav buttons while the day grid is showing - the coarser views read the label set. */
  public previousMonthLabel = input<string | null>(null);
  public nextMonthLabel = input<string | null>(null);

  protected headerTemplate = contentChild(CalendarHeaderDirective);

  protected calendar = this.headless;

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

  protected weekLabel = computed(() => this.calendarLabels().week);

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

  constructor() {
    mountEasingTokens();
    effect(() => {
      // gated on whether a coarser view is reachable at all, not on `calendar.view()` having
      // already left the day grid - mounting on that transition would paint the first drilled-out
      // frame before the styles land
      const canReachCoarseGrid =
        !this.headerTemplate() || this.calendar.view() !== 'month' || this.calendar.selectionView() !== 'month';

      if (canReachCoarseGrid) {
        this.styleManager.mount(CalendarCoarseGridStylesComponent);
      }
    });

    effect(() => {
      if (this.calendar.comparisonStart() !== null || this.calendar.comparisonEnd() !== null) {
        this.styleManager.mount(CalendarComparisonBandStylesComponent);
      }
    });

    effect(() => {
      if (this.weekNumbers()) {
        this.styleManager.mount(CalendarWeekNumbersStylesComponent);
      }
    });
  }
}
