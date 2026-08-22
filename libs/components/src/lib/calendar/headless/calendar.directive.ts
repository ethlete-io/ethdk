import { Directive, computed, input, linkedSignal, model, output, signal } from '@angular/core';
import {
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  getDate,
  getWeek,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  lastDayOfMonth,
  setDate,
  setYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  addDays,
} from 'date-fns';
import { Locale } from 'date-fns';
import { injectDateLocale } from '../../forms/date-time/date-time-formats';
import { isFormInputTarget } from '../../internals/form-input-target';
import { positiveIntegerAttribute } from '../../internals/number-attributes';
import { CalendarWeekStartsOn, generateMonthGrid } from './internals/calendar-month';
import { resolveCalendarKeyboardDate } from './internals/calendar-keyboard';
import {
  CALENDAR_MULTI_YEAR_PAGE_SIZE,
  CALENDAR_UNIT_IS_SAME,
  CALENDAR_PRECISION_VIEW,
  CALENDAR_VIEW_DEPTH,
  CALENDAR_VIEW_UNIT,
  CalendarAvailability,
  CalendarPrecision,
  CalendarView,
  clampCalendarView,
  generateMultiYearGrid,
  generateYearGrid,
  hasSelectableDayIn,
  isInMultiYearPage,
  multiYearPageInterval,
  multiYearPageStart,
  startOfCalendarUnit,
} from './internals/calendar-view';
import { CalendarBandPosition, createCalendarSelectionReader } from './internals/calendar-selection';
import {
  CalendarRange,
  CalendarRangeSelectionStrategy,
  DEFAULT_CALENDAR_RANGE_STRATEGY,
} from './calendar-range-strategy';

export type { CalendarInterval, CalendarPrecision, CalendarView } from './internals/calendar-view';
export type { CalendarRange, CalendarRangeSelectionStrategy } from './calendar-range-strategy';
export type { CalendarBandPosition, CalendarSelectionFlags } from './internals/calendar-selection';
// public because a control that writes dates at a precision needs the same normalization the
// calendar applies - the date inputs use it to make a typed month and a picked month one value
export { startOfCalendarUnit } from './internals/calendar-view';

/**
 * How much a calendar can hold: one date, a range, or any number of unrelated ones. Each mode reads
 * and writes its own model - {@link CalendarDirective.value}, `rangeValue`, `multipleValue` - so
 * switching mode never has to reinterpret the other's value.
 */
export type CalendarMode = 'single' | 'range' | 'multiple';

/** Extra classes for one cell. The returned classes are the consumer's own CSS, so they are unlayered and win over the component's styles. */
export type CalendarDateClassFn = (date: Date, view: CalendarView) => string | string[] | null;

/** Which way the grid last moved - drives the enter transition of the newly rendered grid. */
export type CalendarNavigationDirection = 'forward' | 'backward' | 'zoomIn' | 'zoomOut' | null;

/** What every cell carries, in every view. The day grid's cells add {@link CalendarCell}'s two fields. */
export type CalendarCellBase = {
  /** Start of the unit this cell holds: a day at midnight, a month's 1st, a year's January 1st. */
  date: Date;
  /** The cell's own text - the day of month, the short month name, the year. */
  label: string;
  /** Full localized name of the unit, for the cell's `aria-label`. */
  ariaLabel: string;
  disabled: boolean;
  /** Is, or contains, today. */
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
  band: CalendarBandPosition;
  /** The same, for the comparison range. */
  comparisonBand: CalendarBandPosition;
  /** Roving-tabindex target. */
  focused: boolean;
  /** `dateClass`'s classes for this cell, or `null` when there is no hook. */
  classes: string[] | null;
  /** Day grid only: the cell belongs to an adjacent month. */
  outsideMonth?: boolean;
};

export type CalendarCell = CalendarCellBase & {
  dayOfMonth: number;
  outsideMonth: boolean;
};

/** One month of a day grid - several of them when {@link CalendarDirective.monthsShown} says so. */
export type CalendarMonthPage = {
  /** First day of the month this page holds. */
  month: Date;
  /** Value identity of the month, for template tracking. */
  key: number;
  /** The month's own name, for a per-page caption. */
  label: string;
  weeks: CalendarCell[][];
  /** The week number of each row, by the same index. */
  weekNumbers: number[];
};

export type CalendarWeekday = {
  short: string;
  long: string;
};

/**
 * Headless calendar state: three stacked views (day grid, month grid, year
 * grid), single or range selection, roving cell focus and the full ARIA-grid
 * keyboard model. Operates on `Date` objects only - string parsing/formatting
 * belongs to the input directives.
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

  /**
   * Where an empty calendar opens (and which day it focuses first) - e.g. next
   * month for a booking form. A selection always wins over it, as does an
   * explicit `activeMonth`; without either, the calendar falls back to today.
   */
  public startAt = input<Date | null>(null);

  /**
   * How many consecutive months the day grid shows side by side - two for the classic range picker.
   * The coarser grids are unaffected: drilling out shows one month grid or one year page whatever
   * this says. Wide surfaces only; a picker that has to fit a phone should leave it at one.
   */
  public monthsShown = input(1, { transform: positiveIntegerAttribute });

  /**
   * How precise a selection is. `'month'` makes this a month picker and
   * `'year'` a year picker: the grid holding that unit is the finest one the
   * calendar shows, picking a cell there writes the value, and the value is the
   * start of the unit (`2026-07-01T00:00` for July 2026). Ranges band at the
   * same unit.
   */
  public precision = input<CalendarPrecision>('day');

  /**
   * Which grid the calendar opens on - `'year'` to have the reader pick a month
   * first, `'multiYear'` a year (a birth date, say). Writing {@link view}
   * afterwards drills wherever you like; changing this resets it. A view finer
   * than {@link precision} clamps to the grid that selects.
   */
  public startView = input<CalendarView>('month');

  /**
   * Per-cell classes for markers of your own - busy days, holidays, an event
   * dot. Runs for every rendered cell in every view, so the `view` argument
   * says which unit `date` starts.
   */
  public dateClass = input<CalendarDateClassFn | null>(null);

  /**
   * What a pick means in `range` mode. Unset, the calendar's own rule applies: the first pick opens
   * the range, a later-or-equal second closes it, an earlier one starts over. Name a strategy to
   * snap to whole weeks, take a fixed number of days from wherever the reader clicks, or anything
   * else - see {@link createWeekRangeStrategy} and {@link createFixedLengthRangeStrategy}.
   */
  public rangeSelectionStrategy = input<CalendarRangeSelectionStrategy | null>(null);

  /**
   * A second range to band behind the selection: the period the current one is
   * being compared against ("vs. the previous 30 days"). Presentation only -
   * these cells stay as selectable as any other, and picking never writes here.
   * Given the two the wrong way round, they are read as an interval anyway.
   */
  public comparisonStart = input<Date | null>(null);
  public comparisonEnd = input<Date | null>(null);

  /** Selected date in `single` mode. */
  public value = model<Date | null>(null);
  /** Selected range in `range` mode. */
  public rangeValue = model<CalendarRange>({ start: null, end: null });
  /** Selected dates in `multiple` mode, ascending. Each pick toggles one. */
  public multipleValue = model<Date[]>([]);
  /** First of the displayed month. `null` follows the selection (or today). */
  public activeMonth = model<Date | null>(null);

  /** A month picked in the month grid, at its 1st. Fires whether or not the pick also writes a value. */
  public monthSelect = output<Date>();
  /** A year picked in the year grid, at its January 1st. */
  public yearSelect = output<Date>();

  /** The grid on show. Writable, so a custom header can drill without going through {@link zoomOut}. */
  public view = linkedSignal(() => clampCalendarView(this.startView(), this.precision()));

  /** The finest grid this calendar shows - the one whose cells hold {@link precision}'s unit. */
  public selectionView = computed(() => CALENDAR_PRECISION_VIEW[this.precision()]);

  private today = startOfDay(new Date());

  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public effectiveFirstDayOfWeek = computed<CalendarWeekStartsOn>(
    () => this.firstDayOfWeek() ?? this.effectiveLocale()?.options?.weekStartsOn ?? 1,
  );

  private anchorDate = computed(() => {
    const mode = this.mode();

    if (mode === 'range') {
      const range = this.rangeValue();

      return range.start ?? range.end ?? this.startAt() ?? this.today;
    }

    if (mode === 'multiple') {
      return this.multipleValue()[0] ?? this.startAt() ?? this.today;
    }

    return this.value() ?? this.startAt() ?? this.today;
  });

  public visibleMonth = computed(() => startOfMonth(this.activeMonth() ?? this.anchorDate()));

  /** Value identity of the visible month, for template keying. */
  public visibleMonthKey = computed(() => this.visibleMonth().getTime());

  /** The year the month grid shows - the visible month's. */
  public visibleYear = computed(() => startOfYear(this.visibleMonth()));

  /**
   * First year of the year grid's visible page. Pages tile from `min`'s year when there is one, so a
   * bounded calendar opens its page on the bound instead of somewhere inside it.
   */
  public multiYearPageStart = computed(() => multiYearPageStart(this.visibleMonth(), this.min()?.getFullYear() ?? 0));

  /** Value identity of the unit the current view shows - the month, the year, or the year page. */
  public visibleUnitKey = computed(() => {
    switch (this.view()) {
      case 'year':
        return this.visibleYear().getTime();
      case 'multiYear':
        return this.multiYearPageStart().getTime();
      default:
        return this.visibleMonthKey();
    }
  });

  /** Identity of what is on screen, for template keying: a view change re-renders the grid too. */
  public transitionKey = computed(() => `${this.view()}:${this.visibleUnitKey()}`);

  /**
   * Flips whenever {@link transitionKey} changes. Re-creating the grid is how its enter transition
   * runs, and a template gets there by rendering one of two identical `@if` branches: keying a
   * one-item `@for` on the key would do the same thing, but Angular reports every such re-creation as
   * NG0956 - a warning about an expensive mistake, which for one row of a calendar it is not, in every
   * consumer's dev console on every step.
   */
  public transitionParity = linkedSignal<string, boolean>({
    source: () => this.transitionKey(),
    computation: (_key, previous) => (previous === undefined ? true : !previous.value),
  });

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

  /**
   * How the grid last changed - drives the transition styling. Chronological for a step within one view,
   * and which way the reader zoomed for a view change (`'zoomOut'` towards the year grid).
   */
  public navigationDirection = linkedSignal<{ view: CalendarView; unit: number }, CalendarNavigationDirection>({
    source: () => ({ view: this.view(), unit: this.visibleUnitKey() }),
    computation: (source, previous) => {
      if (previous === undefined) {
        return null;
      }

      if (previous.source.view !== source.view) {
        return CALENDAR_VIEW_DEPTH[source.view] > CALENDAR_VIEW_DEPTH[previous.source.view] ? 'zoomOut' : 'zoomIn';
      }

      if (previous.source.unit === source.unit) {
        return previous.value;
      }

      return source.unit > previous.source.unit ? 'forward' : 'backward';
    },
  });

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

  /** Reused per coarse cell, so the day scan reads the bounds and the filter from one place. */
  private availability = computed<CalendarAvailability>(() => ({
    min: this.min(),
    max: this.max(),
    isDateSelectable: (date: Date) => !this.isDateDisabled(date),
  }));

  /**
   * Every month on show, first to last - one unless {@link monthsShown} says otherwise. One selection
   * reader serves all of them, which is what carries a range band across the seam between two months.
   */
  public monthPages = computed<CalendarMonthPage[]>(() => {
    const firstMonth = this.visibleMonth();
    const focused = this.focusedDate();
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const weekStartsOn = this.effectiveFirstDayOfWeek();
    const firstWeekContainsDate = locale?.options?.firstWeekContainsDate ?? 1;
    const readSelection = this.selectionReader('month');

    return Array.from({ length: this.monthsShown() }, (_, offset) => {
      const month = addMonths(firstMonth, offset);
      const grid = generateMonthGrid(month, weekStartsOn);

      return {
        month,
        key: month.getTime(),
        label: format(month, 'LLLL yyyy', labelOptions),
        weekNumbers: grid.map(([weekStart]) => getWeek(weekStart as Date, { weekStartsOn, firstWeekContainsDate })),
        weeks: grid.map((week) =>
          week.map((date) => ({
            date,
            dayOfMonth: getDate(date),
            label: `${getDate(date)}`,
            ariaLabel: format(date, 'PPPP', labelOptions),
            classes: this.resolveCellClasses(date, 'month'),
            disabled: this.isDateDisabled(date),
            today: isSameDay(date, this.today),
            ...readSelection(date),
            outsideMonth: !isSameMonth(date, month),
            // one roving target across the whole span: an outside-month cell never claims it, or two
            // grids would fight over the same date
            focused: isSameDay(date, focused) && isSameMonth(date, month),
          })),
        ),
      };
    });
  });

  /**
   * The week number of each row of {@link weeks}, by the same index - every month on show carries its
   * own on {@link monthPages}. Localized rather than always ISO: which week is the year's first depends
   * on the locale's `firstWeekContainsDate`, and the rows themselves start on
   * {@link effectiveFirstDayOfWeek}, so the numbering has to follow both or it would name rows the
   * calendar is not showing.
   */
  public weekNumbers = computed<number[]>(() => this.monthPages()[0]?.weekNumbers ?? []);

  /** The first month's day grid. The whole span is {@link monthPages}. */
  public weeks = computed<CalendarCell[][]>(() => this.monthPages()[0]?.weeks ?? []);

  /** The last month on show - the same as {@link visibleMonth} unless several are shown. */
  public lastVisibleMonth = computed(() => addMonths(this.visibleMonth(), this.monthsShown() - 1));

  /** What the header names: the month, the year, or the year page's span. */
  public headerLabel = computed(() => {
    const locale = this.effectiveLocale();
    const options = locale ? { locale } : undefined;

    switch (this.view()) {
      case 'year':
        return format(this.visibleYear(), 'yyyy', options);
      case 'multiYear': {
        const pageStart = this.multiYearPageStart();
        const pageEnd = addYears(pageStart, CALENDAR_MULTI_YEAR_PAGE_SIZE - 1);

        return `${format(pageStart, 'yyyy', options)} – ${format(pageEnd, 'yyyy', options)}`;
      }
      default: {
        const first = this.visibleMonth();
        const last = this.lastVisibleMonth();

        if (isSameMonth(first, last)) {
          return this.visibleMonthLabel();
        }

        // "July – August 2026" while one year covers the span, "December 2026 – January 2027" once it
        // does not: naming the year twice for two months of the same one is noise
        return isSameYear(first, last)
          ? `${format(first, 'LLLL', options)} – ${format(last, 'LLLL yyyy', options)}`
          : `${format(first, 'LLLL yyyy', options)} – ${format(last, 'LLLL yyyy', options)}`;
      }
    }
  });

  /** The 12 months of the visible year, as rows of four - the month grid's cells. */
  public monthCells = computed<CalendarCellBase[][]>(() => {
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const focused = this.focusedDate();
    const readSelection = this.selectionReader('year');

    return generateYearGrid(this.visibleYear()).map((row) =>
      row.map((month) => ({
        date: month,
        label: format(month, 'LLL', labelOptions),
        ariaLabel: format(month, 'LLLL yyyy', labelOptions),
        classes: this.resolveCellClasses(month, 'year'),
        disabled: this.isMonthDisabled(month),
        today: isSameMonth(month, this.today),
        ...readSelection(month),
        focused: isSameMonth(month, focused),
      })),
    );
  });

  /** The years of the visible page, as rows of four - the year grid's cells. */
  public yearCells = computed<CalendarCellBase[][]>(() => {
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const focused = this.focusedDate();
    const readSelection = this.selectionReader('multiYear');

    return generateMultiYearGrid(this.multiYearPageStart()).map((row) =>
      row.map((year) => {
        const label = format(year, 'yyyy', labelOptions);

        return {
          date: year,
          label,
          ariaLabel: label,
          classes: this.resolveCellClasses(year, 'multiYear'),
          disabled: this.isYearDisabled(year),
          today: isSameYear(year, this.today),
          ...readSelection(year),
          focused: isSameYear(year, focused),
        };
      }),
    );
  });

  public canGoPrev = computed(() => {
    const min = this.min();

    return min === null || !isBefore(this.adjacentUnit(-1).end, startOfDay(min));
  });

  public canGoNext = computed(() => {
    const max = this.max();

    return max === null || !isAfter(this.adjacentUnit(1).start, startOfDay(max));
  });

  /**
   * Whether the header can zoom out any further: false once the year grid is showing, and for a
   * year-precision calendar, whose only grid that is.
   */
  public canZoomOut = computed(() => this.view() !== 'multiYear');

  /** The strategy in play: the consumer's, else the calendar's own rule. */
  private effectiveRangeStrategy = computed(() => this.rangeSelectionStrategy() ?? DEFAULT_CALENDAR_RANGE_STRATEGY);

  /**
   * What the band should promise while the reader is only hovering (or has moved keyboard focus).
   * A strategy that does not say gets what its own `select` would produce, which is the honest
   * default: the preview shows what the pick would do.
   */
  private previewRange = computed<CalendarRange>(() => {
    if (this.mode() !== 'range') {
      return { start: null, end: null };
    }

    const strategy = this.effectiveRangeStrategy();
    const at = this.hoveredDate() ?? this.focusedDate();
    const current = this.rangeValue();

    return (
      (strategy.preview ? strategy.preview(at, current) : strategy.select(at, current)) ?? {
        start: null,
        end: null,
      }
    );
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

  /** Whether the month holds no selectable day at all - what disables its cell in the month grid. */
  public isMonthDisabled(month: Date) {
    return !hasSelectableDayIn({ start: startOfMonth(month), end: endOfMonth(month) }, this.availability());
  }

  /** Whether the year holds no selectable day at all - what disables its cell in the year grid. */
  public isYearDisabled(year: Date) {
    return !hasSelectableDayIn({ start: startOfYear(year), end: endOfYear(year) }, this.availability());
  }

  /**
   * Activates the focused cell of whichever view is showing: writes the value when that grid is the
   * one {@link precision} selects in, drills a level in otherwise. So a day-precision calendar
   * selects in the day grid and treats a month or year pick as navigation, while a month-precision
   * one selects the month itself.
   */
  public activateCell(date: Date) {
    switch (this.view()) {
      case 'year':
        return this.selectMonth(date);
      case 'multiYear':
        return this.selectYear(date);
      default:
        return this.selectDate(date);
    }
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

    this.commitSelection(day);
  }

  /**
   * Picks a month in the month grid: writes it at month precision, drills into its day grid
   * otherwise - the reader has narrowed down where to look, not picked a date yet.
   */
  public selectMonth(date: Date) {
    const month = startOfMonth(date);

    if (this.isMonthDisabled(month)) {
      return;
    }

    this.monthSelect.emit(month);

    if (this.precision() === 'month') {
      this.commitSelection(month);

      return;
    }

    this.activeMonth.set(month);
    this.view.set('month');
  }

  /**
   * Picks a year in the year grid: writes it at year precision, drills into its months otherwise,
   * keeping the month the reader was on.
   */
  public selectYear(date: Date) {
    const year = startOfYear(date);

    if (this.isYearDisabled(year)) {
      return;
    }

    this.yearSelect.emit(year);

    if (this.precision() === 'year') {
      this.commitSelection(year);

      return;
    }

    this.activeMonth.set(setYear(this.visibleMonth(), year.getFullYear()));
    this.view.set('year');
  }

  /**
   * Zooms the grid out one level - day grid → month grid → year grid - which is what the header label
   * does. From the year grid, which has nothing coarser above it, it returns to the finest grid this
   * calendar has, so the header is never a dead end for a reader who opened it by accident.
   */
  public zoomOut() {
    switch (this.view()) {
      case 'month':
        return this.view.set('year');
      case 'year':
        return this.view.set('multiYear');
      default:
        return this.view.set(this.selectionView());
    }
  }

  /** Steps the visible unit forwards - a month, a year, or a year page, depending on the view. */
  public next() {
    this.stepUnit(1);
  }

  /** Steps the visible unit backwards. */
  public previous() {
    this.stepUnit(-1);
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
    if (isFormInputTarget(event.target)) return;

    const target = resolveCalendarKeyboardDate(event.key, {
      shiftKey: event.shiftKey,
      focusedDate: this.focusedDate(),
      weekStartsOn: this.effectiveFirstDayOfWeek(),
      view: this.view(),
      multiYearPageStart: this.multiYearPageStart(),
    });

    if (target === null) {
      return;
    }

    event.preventDefault();
    this.moveFocus(target);
  }

  /**
   * Reads how a cell relates to the selection, comparing at the unit the given view's cells hold.
   * One implementation for all three grids, which is what makes a month- or year-precision range
   * band its own cells.
   */
  private selectionReader(view: CalendarView) {
    return createCalendarSelectionReader({
      mode: this.mode(),
      value: this.value(),
      values: this.multipleValue(),
      rangeStart: this.rangeValue().start,
      rangeEnd: this.rangeValue().end,
      previewStart: this.previewRange().start,
      previewEnd: this.previewRange().end,
      comparisonStart: this.comparisonStart(),
      comparisonEnd: this.comparisonEnd(),
      unit: CALENDAR_VIEW_UNIT[view],
    });
  }

  /**
   * Writes a pick, whatever unit it names. Range mode: the first pick starts the range, a
   * later-or-equal second completes it, an earlier one restarts it - compared at the precision's
   * unit, so picking the range's own start month again completes a one-month range rather than
   * restarting it.
   */
  private commitSelection(date: Date) {
    const precision = this.precision();
    const unitStart = startOfCalendarUnit(date, precision);
    const mode = this.mode();

    this.moveFocus(unitStart);

    if (mode === 'single') {
      this.value.set(unitStart);

      return;
    }

    if (mode === 'multiple') {
      this.toggleMultiple(unitStart);

      return;
    }

    const current = this.rangeValue();
    const next = this.effectiveRangeStrategy().select(unitStart, current);
    // a strategy works in days; the calendar's precision is what the value has to land on
    const resolved = {
      start: next.start === null ? null : startOfCalendarUnit(next.start, precision),
      end: next.end === null ? null : startOfCalendarUnit(next.end, precision),
    };

    this.rangeValue.set(resolved);

    if (resolved.end !== null) {
      this.hoveredDate.set(null);
    }
  }

  /**
   * Adds a date to the `multiple` set, or takes it out again when it is already in - a second pick of
   * the same cell is how a reader unpicks it. Kept ascending, so a consumer never has to sort by hand
   * and the calendar's own anchor is the earliest date.
   */
  private toggleMultiple(unitStart: Date) {
    const isSameUnit = CALENDAR_UNIT_IS_SAME[this.precision()];
    const current = this.multipleValue();
    const without = current.filter((picked) => !isSameUnit(picked, unitStart));

    if (without.length !== current.length) {
      this.multipleValue.set(without);

      return;
    }

    this.multipleValue.set([...current, unitStart].sort((left, right) => left.getTime() - right.getTime()));
  }

  /** `dateClass`'s classes for one cell, normalized to a list. `null` when there is no hook. */
  private resolveCellClasses(date: Date, view: CalendarView) {
    const classes = this.dateClass()?.(date, view) ?? null;

    if (classes === null) {
      return null;
    }

    return Array.isArray(classes) ? classes : [classes];
  }

  /** Moves the visible unit by `step` of whatever the current view pages by, keeping the month within a year. */
  private stepUnit(step: 1 | -1) {
    const month = this.visibleMonth();

    switch (this.view()) {
      case 'year':
        return this.activeMonth.set(addYears(month, step));
      case 'multiYear':
        return this.activeMonth.set(addYears(month, step * CALENDAR_MULTI_YEAR_PAGE_SIZE));
      default:
        return this.activeMonth.set(addMonths(month, step));
    }
  }

  /**
   * The unit one step away in the current view - what the nav guards test against the bounds. With
   * several months on show, a step off the end leaves from the last of them, not the first.
   */
  private adjacentUnit(step: 1 | -1) {
    const month = this.visibleMonth();

    switch (this.view()) {
      case 'year': {
        const year = addYears(month, step);

        return { start: startOfYear(year), end: endOfYear(year) };
      }
      case 'multiYear':
        return multiYearPageInterval(addYears(this.multiYearPageStart(), step * CALENDAR_MULTI_YEAR_PAGE_SIZE));
      default: {
        const from = step === 1 ? this.lastVisibleMonth() : month;
        const stepped = addMonths(from, step);

        return { start: startOfMonth(stepped), end: endOfMonth(stepped) };
      }
    }
  }

  private moveFocus(date: Date) {
    const day = startOfDay(date);

    // The span follows the roving focus out of itself - in every view, since the focused date stays a
    // full date and only the step size differs. Where several months are on show it shifts by as little
    // as it takes to cover the new focus, so the reader keeps the months either side of it.
    if (!this.isInVisibleUnit(day)) {
      const month = startOfMonth(day);

      this.activeMonth.set(
        this.view() === 'month' && isAfter(month, this.lastVisibleMonth())
          ? addMonths(month, 1 - this.monthsShown())
          : month,
      );
    }

    this.focusedDate.set(day);
  }

  /** Whether a date falls inside what the current view is showing - the whole span in the day grid. */
  private isInVisibleUnit(date: Date) {
    switch (this.view()) {
      case 'year':
        return isSameYear(date, this.visibleYear());
      case 'multiYear':
        return isInMultiYearPage(date, this.multiYearPageStart());
      default: {
        const month = startOfMonth(date);

        return !isBefore(month, this.visibleMonth()) && !isAfter(month, this.lastVisibleMonth());
      }
    }
  }
}
