import { Directive, computed, input, linkedSignal, model, signal } from '@angular/core';
import {
  addMonths,
  endOfMonth,
  format,
  getDate,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  lastDayOfMonth,
  setDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  addDays,
} from 'date-fns';
import { Locale } from 'date-fns';
import { injectDateLocale } from '../../forms/date-time/date-time-formats';
import { CalendarWeekStartsOn, generateMonthGrid } from './internals/calendar-month';
import { resolveCalendarKeyboardDate } from './internals/calendar-keyboard';

export type CalendarMode = 'single' | 'range';

export type CalendarRange = {
  start: Date | null;
  end: Date | null;
};

export type CalendarCell = {
  /** Day-granular (midnight) date of this cell. */
  date: Date;
  dayOfMonth: number;
  /** Full localized date, for the cell's `aria-label`. */
  ariaLabel: string;
  disabled: boolean;
  today: boolean;
  /** The single value, or a range boundary. */
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  /** Strictly between a committed range's start and end. */
  inRange: boolean;
  /** Between the pending range start and the hovered/focused date. */
  inHoverPreview: boolean;
  /** Presentational position inside the committed or previewed range band. */
  band: 'start' | 'middle' | 'end' | null;
  outsideMonth: boolean;
  /** Roving-tabindex target. */
  focused: boolean;
};

export type CalendarWeekday = {
  short: string;
  long: string;
};

/**
 * Headless calendar state: one visible month, single or range selection,
 * roving cell focus and the full ARIA-grid keyboard model. Operates on `Date`
 * objects only — string parsing/formatting belongs to the input directives.
 */
@Directive({
  selector: '[etCalendar]',
  exportAs: 'etCalendar',
})
export class CalendarDirective {
  private defaultLocale = injectDateLocale();

  public mode = input<CalendarMode>('single');
  public min = input<Date | null>(null);
  public max = input<Date | null>(null);
  /** Return `false` to make a date unselectable. */
  public dateFilter = input<((date: Date) => boolean) | null>(null);
  /** 0 = Sunday … 6 = Saturday. Defaults to the locale's week start, else Monday. */
  public firstDayOfWeek = input<CalendarWeekStartsOn | undefined>(undefined);
  public locale = input<Locale | null>(null);

  /** Selected date in `single` mode. */
  public value = model<Date | null>(null);
  /** Selected range in `range` mode. */
  public rangeValue = model<CalendarRange>({ start: null, end: null });
  /** First of the displayed month. `null` follows the selection (or today). */
  public activeMonth = model<Date | null>(null);

  private today = startOfDay(new Date());

  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public effectiveFirstDayOfWeek = computed<CalendarWeekStartsOn>(
    () => this.firstDayOfWeek() ?? this.effectiveLocale()?.options?.weekStartsOn ?? 1,
  );

  private anchorDate = computed(() => {
    if (this.mode() === 'range') {
      const range = this.rangeValue();

      return range.start ?? range.end ?? this.today;
    }

    return this.value() ?? this.today;
  });

  public visibleMonth = computed(() => startOfMonth(this.activeMonth() ?? this.anchorDate()));

  /**
   * Roving-tabindex target. Re-anchors when the visible month changes without
   * containing it (keeping the day of month across month navigation).
   */
  public focusedDate = linkedSignal<Date, Date>({
    source: () => this.visibleMonth(),
    computation: (month, previous) => {
      if (previous !== undefined && isSameMonth(previous.value, month)) {
        return previous.value;
      }

      const anchor = startOfDay(this.anchorDate());

      if (isSameMonth(anchor, month)) {
        return anchor;
      }

      const dayOfMonth = previous === undefined ? 1 : getDate(previous.value);

      return setDate(month, Math.min(dayOfMonth, getDate(lastDayOfMonth(month))));
    },
  });

  /** Range-preview endpoint while the pointer is over the grid. */
  public hoveredDate = signal<Date | null>(null);

  public weekdays = computed<CalendarWeekday[]>(() => {
    const locale = this.effectiveLocale();
    const options = locale ? { locale } : undefined;
    const weekStart = startOfWeek(this.today, { weekStartsOn: this.effectiveFirstDayOfWeek() });

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = addDays(weekStart, dayIndex);

      return {
        short: format(day, 'EEEEEE', options),
        long: format(day, 'EEEE', options),
      };
    });
  });

  public visibleMonthLabel = computed(() => {
    const locale = this.effectiveLocale();

    return format(this.visibleMonth(), 'LLLL yyyy', locale ? { locale } : undefined);
  });

  public weeks = computed<CalendarCell[][]>(() => {
    const month = this.visibleMonth();
    const mode = this.mode();
    const value = this.value();
    const range = this.rangeValue();
    const focused = this.focusedDate();
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const start = mode === 'range' && range.start ? startOfDay(range.start) : null;
    const end = mode === 'range' && range.end ? startOfDay(range.end) : null;
    let previewStart: Date | null = null;
    let previewEnd: Date | null = null;

    if (start !== null && end === null) {
      const preview = startOfDay(this.hoveredDate() ?? focused);

      previewStart = isBefore(preview, start) ? preview : start;
      previewEnd = isBefore(preview, start) ? start : preview;
    }

    // the visual band spans the committed range, or the pending preview
    let bandStart: Date | null = null;
    let bandEnd: Date | null = null;

    if (start !== null && end !== null && !isSameDay(start, end)) {
      bandStart = start;
      bandEnd = end;
    } else if (previewStart !== null && previewEnd !== null && !isSameDay(previewStart, previewEnd)) {
      bandStart = previewStart;
      bandEnd = previewEnd;
    }

    return generateMonthGrid(month, this.effectiveFirstDayOfWeek()).map((week) =>
      week.map((date) => {
        const rangeStart = start !== null && isSameDay(date, start);
        const rangeEnd = end !== null && isSameDay(date, end);

        return {
          date,
          dayOfMonth: getDate(date),
          ariaLabel: format(date, 'PPPP', labelOptions),
          disabled: this.isDateDisabled(date),
          today: isSameDay(date, this.today),
          selected: mode === 'single' ? value !== null && isSameDay(date, value) : rangeStart || rangeEnd,
          rangeStart,
          rangeEnd,
          inRange: start !== null && end !== null && isAfter(date, start) && isBefore(date, end),
          inHoverPreview:
            previewStart !== null &&
            previewEnd !== null &&
            !isSameDay(previewStart, previewEnd) &&
            !isBefore(date, previewStart) &&
            !isAfter(date, previewEnd),
          band:
            bandStart !== null && bandEnd !== null
              ? isSameDay(date, bandStart)
                ? ('start' as const)
                : isSameDay(date, bandEnd)
                  ? ('end' as const)
                  : isAfter(date, bandStart) && isBefore(date, bandEnd)
                    ? ('middle' as const)
                    : null
              : null,
          outsideMonth: !isSameMonth(date, month),
          focused: isSameDay(date, focused),
        };
      }),
    );
  });

  public canGoPrev = computed(() => {
    const min = this.min();

    return min === null || !isBefore(endOfMonth(addMonths(this.visibleMonth(), -1)), startOfDay(min));
  });

  public canGoNext = computed(() => {
    const max = this.max();

    return max === null || !isAfter(startOfMonth(addMonths(this.visibleMonth(), 1)), startOfDay(max));
  });

  public isDateDisabled(date: Date) {
    const min = this.min();
    const max = this.max();

    if (min !== null && isBefore(date, startOfDay(min))) {
      return true;
    }

    if (max !== null && isAfter(date, startOfDay(max))) {
      return true;
    }

    const filter = this.dateFilter();

    return filter !== null && !filter(date);
  }

  /**
   * Single mode sets the value. Range mode: first pick starts the range, a
   * later-or-equal second pick completes it, an earlier one restarts it.
   */
  public selectDate(date: Date) {
    const day = startOfDay(date);

    if (this.isDateDisabled(day)) {
      return;
    }

    this.moveFocus(day);

    if (this.mode() === 'single') {
      this.value.set(day);

      return;
    }

    const { start, end } = this.rangeValue();

    if (!start || end || isBefore(day, startOfDay(start))) {
      this.rangeValue.set({ start: day, end: null });

      return;
    }

    this.rangeValue.set({ start, end: day });
    this.hoveredDate.set(null);
  }

  public nextMonth() {
    this.activeMonth.set(addMonths(this.visibleMonth(), 1));
  }

  public previousMonth() {
    this.activeMonth.set(addMonths(this.visibleMonth(), -1));
  }

  public nextYear() {
    this.activeMonth.set(addMonths(this.visibleMonth(), 12));
  }

  public previousYear() {
    this.activeMonth.set(addMonths(this.visibleMonth(), -12));
  }

  /** @internal ARIA-grid keyboard model; selection stays with the cell button's native activation. */
  public handleKeydown(event: KeyboardEvent) {
    const target = resolveCalendarKeyboardDate(event.key, {
      shiftKey: event.shiftKey,
      focusedDate: this.focusedDate(),
      weekStartsOn: this.effectiveFirstDayOfWeek(),
    });

    if (target === null) {
      return;
    }

    event.preventDefault();
    this.moveFocus(target);
  }

  private moveFocus(date: Date) {
    const day = startOfDay(date);

    if (!isSameMonth(day, this.visibleMonth())) {
      this.activeMonth.set(startOfMonth(day));
    }

    this.focusedDate.set(day);
  }
}
