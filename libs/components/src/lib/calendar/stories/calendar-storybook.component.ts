import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { addDays, addMonths, startOfDay, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CalendarDateClassFn,
  CalendarMode,
  CalendarPrecision,
  CalendarRange,
  CalendarRangeSelectionStrategy,
  CalendarView,
  createFixedLengthRangeStrategy,
  createWeekRangeStrategy,
} from '../headless';
import { CALENDAR_IMPORTS } from '../calendar.imports';

@Component({
  selector: 'et-sb-calendar',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col items-start gap-4 p-8 font-sans">
      @if (mode() === 'multiple') {
        <et-calendar
          [(multipleValue)]="multipleValue"
          [min]="minDate()"
          [max]="maxDate()"
          [dateFilter]="filterFn()"
          [startAt]="startAtDate()"
          [monthsShown]="monthsShown()"
          [precision]="precision()"
          [startView]="startView()"
          [dateClass]="dateClassFn()"
          [weekNumbers]="weekNumbers()"
          [locale]="localeObject()"
          (monthSelect)="lastDrill.set('month ' + $event.toDateString())"
          (yearSelect)="lastDrill.set('year ' + $event.toDateString())"
          mode="multiple"
        />

        <p class="text-sm opacity-60">
          Picked ({{ multipleValue().length }}):
          {{ pickedLabel() }}
        </p>
      } @else if (mode() === 'range') {
        <et-calendar
          [(rangeValue)]="rangeValue"
          [min]="minDate()"
          [max]="maxDate()"
          [dateFilter]="filterFn()"
          [startAt]="startAtDate()"
          [monthsShown]="monthsShown()"
          [precision]="precision()"
          [startView]="startView()"
          [dateClass]="dateClassFn()"
          [weekNumbers]="weekNumbers()"
          [rangeSelectionStrategy]="rangeStrategyFn()"
          [comparisonStart]="comparisonStart()"
          [comparisonEnd]="comparisonEnd()"
          [locale]="localeObject()"
          (monthSelect)="lastDrill.set('month ' + $event.toDateString())"
          (yearSelect)="lastDrill.set('year ' + $event.toDateString())"
          mode="range"
        />

        <p class="text-sm opacity-60">
          Range: {{ rangeValue().start?.toDateString() ?? 'null' }} → {{ rangeValue().end?.toDateString() ?? 'null' }}
        </p>
      } @else {
        <et-calendar
          [(value)]="value"
          [min]="minDate()"
          [max]="maxDate()"
          [dateFilter]="filterFn()"
          [startAt]="startAtDate()"
          [monthsShown]="monthsShown()"
          [precision]="precision()"
          [startView]="startView()"
          [dateClass]="dateClassFn()"
          [weekNumbers]="weekNumbers()"
          [locale]="localeObject()"
          (monthSelect)="lastDrill.set('month ' + $event.toDateString())"
          (yearSelect)="lastDrill.set('year ' + $event.toDateString())"
        >
          @if (customHeader()) {
            <!-- a header of the consumer's own: same state, own layout and wording -->
            <ng-template etCalendarHeader let-calendar>
              <div class="et-sb-calendar-header">
                <button [disabled]="!calendar.canGoPrev()" (click)="calendar.previous()" type="button">Back</button>

                <button (click)="calendar.zoomOut()" type="button">
                  {{ calendar.headerLabel() }} ({{ calendar.view() }})
                </button>

                <button [disabled]="!calendar.canGoNext()" (click)="calendar.next()" type="button">Next</button>
              </div>
            </ng-template>
          }
        </et-calendar>

        <p class="text-sm opacity-60">Value: {{ value()?.toDateString() ?? 'null' }}</p>
      }

      @if (lastDrill()) {
        <p class="text-sm opacity-60">Drilled into: {{ lastDrill() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...CALENDAR_IMPORTS, ProvideColorDirective],
  // Consumer CSS, which is what `dateClass` returns: unlayered, so it wins over the component's own
  // styles without any escalation.
  styles: `
    .et-sb-calendar-busy .et-calendar-cell-content {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--et-theme-color-primary-solid) 60%, transparent);
    }

    .et-sb-calendar-holiday .et-calendar-cell-content {
      background: color-mix(in srgb, var(--et-theme-color-primary-solid) 18%, transparent);
      font-weight: 600;
    }

    .et-sb-calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-block-end: 8px;

      & button {
        padding: 4px 8px;
        border: 1px solid var(--et-surface-border-solid);
        border-radius: 6px;
        background: transparent;
        font: inherit;
        font-size: 12px;
        color: inherit;
        cursor: pointer;
      }

      & button:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }
  `,
})
export class CalendarStorybookComponent {
  public mode = input<CalendarMode>('single');
  public constrained = input(false);
  public disableWeekends = input(false);
  /** Months from today the empty calendar should open at - the story turns it into a `Date`. */
  public startAtMonthOffset = input<number | null>(null);
  public precision = input<CalendarPrecision>('day');
  public startView = input<CalendarView>('month');
  /** Turns on a `dateClass` hook marking the 1st of each month and every 13th - the story owns the CSS. */
  public markDates = input(false);
  public weekNumbers = input(false);
  /** Bands the seven days before the month's 10th as a comparison period. */
  public showComparison = input(false);
  /** Which range-selection strategy the range calendar uses. */
  public rangeStrategy = input<'default' | 'week' | 'fixed7'>('default');
  /** Swaps the calendar's own header for a projected one. */
  public customHeader = input(false);
  public monthsShown = input(1);
  public locale = input<'default' | 'de'>('default');
  public color = input('brand');

  public value = signal<Date | null>(null);
  public rangeValue = signal<CalendarRange>({ start: null, end: null });
  public multipleValue = signal<Date[]>([]);
  protected lastDrill = signal<string | null>(null);

  protected minDate = computed(() => (this.constrained() ? startOfDay(addDays(new Date(), -7)) : null));
  protected maxDate = computed(() => (this.constrained() ? startOfDay(addDays(new Date(), 60)) : null));

  protected filterFn = computed(() =>
    this.disableWeekends() ? (date: Date) => date.getDay() !== 0 && date.getDay() !== 6 : null,
  );

  protected startAtDate = computed(() => {
    const offset = this.startAtMonthOffset();

    return offset === null ? null : startOfMonth(addMonths(new Date(), offset));
  });

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  protected rangeStrategyFn = computed<CalendarRangeSelectionStrategy | null>(() => {
    switch (this.rangeStrategy()) {
      case 'week':
        return createWeekRangeStrategy({ weekStartsOn: this.localeObject()?.options?.weekStartsOn ?? 1 });
      case 'fixed7':
        return createFixedLengthRangeStrategy({ days: 7 });
      default:
        return null;
    }
  });

  /** The seven days running up to the visible month's 10th - a stand-in for "the previous period". */
  protected comparisonStart = computed(() => (this.showComparison() ? startOfDay(new Date(2026, 6, 3)) : null));

  protected comparisonEnd = computed(() => (this.showComparison() ? startOfDay(new Date(2026, 6, 9)) : null));

  protected pickedLabel = computed(() => {
    const picked = this.multipleValue();

    return picked.length === 0 ? 'none' : picked.map((date) => date.toDateString()).join(' · ');
  });

  protected dateClassFn = computed<CalendarDateClassFn | null>(() => {
    if (!this.markDates()) {
      return null;
    }

    // the same hook serves every view, which is what the second argument is for
    return (date, view) => {
      if (view === 'multiYear') {
        return date.getFullYear() % 5 === 0 ? 'et-sb-calendar-holiday' : null;
      }

      if (view === 'year') {
        return date.getMonth() === 0 ? 'et-sb-calendar-holiday' : null;
      }

      if (date.getDate() === 1) {
        return 'et-sb-calendar-holiday';
      }

      return date.getDate() === 13 ? ['et-sb-calendar-busy'] : null;
    };
  });
}
