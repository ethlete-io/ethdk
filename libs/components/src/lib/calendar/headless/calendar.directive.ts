import { Directive, computed, input, linkedSignal, model, output, signal } from '@angular/core';
import {
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  getDate,
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
import { CalendarWeekStartsOn, generateMonthGrid } from './internals/calendar-month';
import { resolveCalendarKeyboardDate } from './internals/calendar-keyboard';
import {
  CALENDAR_MULTI_YEAR_PAGE_SIZE,
  CALENDAR_VIEW_DEPTH,
  CalendarAvailability,
  CalendarView,
  generateMultiYearGrid,
  generateYearGrid,
  hasSelectableDayIn,
  isInMultiYearPage,
  multiYearPageInterval,
  multiYearPageStart,
} from './internals/calendar-view';

export type { CalendarInterval, CalendarView } from './internals/calendar-view';

export type CalendarMode = 'single' | 'range';

export type CalendarRange = {
  start: Date | null;
  end: Date | null;
};

/** Extra classes for one cell. The returned classes are the consumer's own CSS, so they are unlayered and win over the component's styles. */
export type CalendarDateClassFn = (date: Date, view: CalendarView) => string | string[] | null;

/** Which way the grid last moved — drives the enter transition of the newly rendered grid. */
export type CalendarNavigationDirection = 'forward' | 'backward' | 'zoomIn' | 'zoomOut' | null;

/** What every cell carries, in every view. The day grid's cells add {@link CalendarCell}'s two fields. */
export type CalendarCellBase = {
  /** Start of the unit this cell holds: a day at midnight, a month's 1st, a year's January 1st. */
  date: Date;
  /** The cell's own text — the day of month, the short month name, the year. */
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
  band: 'start' | 'middle' | 'end' | null;
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

export type CalendarWeekday = {
  short: string;
  long: string;
};

/**
 * Headless calendar state: three stacked views (day grid, month grid, year
 * grid), single or range selection, roving cell focus and the full ARIA-grid
 * keyboard model. Operates on `Date` objects only — string parsing/formatting
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
   * Where an empty calendar opens (and which day it focuses first) — e.g. next
   * month for a booking form. A selection always wins over it, as does an
   * explicit `activeMonth`; without either, the calendar falls back to today.
   */
  public startAt = input<Date | null>(null);

  /**
   * Which grid the calendar opens on — `'year'` to have the reader pick a month
   * first, `'multiYear'` a year (a birth date, say). Writing {@link view}
   * afterwards drills wherever you like; changing this resets it.
   */
  public startView = input<CalendarView>('month');

  /**
   * Per-cell classes for markers of your own — busy days, holidays, an event
   * dot. Runs for every rendered cell in every view, so the `view` argument
   * says which unit `date` starts.
   */
  public dateClass = input<CalendarDateClassFn | null>(null);

  /** Selected date in `single` mode. */
  public value = model<Date | null>(null);
  /** Selected range in `range` mode. */
  public rangeValue = model<CalendarRange>({ start: null, end: null });
  /** First of the displayed month. `null` follows the selection (or today). */
  public activeMonth = model<Date | null>(null);

  /** A month picked in the month grid, at its 1st. Fires whether or not the pick also writes a value. */
  public monthSelect = output<Date>();
  /** A year picked in the year grid, at its January 1st. */
  public yearSelect = output<Date>();

  /** The grid on show. Writable, so a custom header can drill without going through {@link zoomOut}. */
  public view = linkedSignal(() => this.startView());

  private today = startOfDay(new Date());

  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public effectiveFirstDayOfWeek = computed<CalendarWeekStartsOn>(
    () => this.firstDayOfWeek() ?? this.effectiveLocale()?.options?.weekStartsOn ?? 1,
  );

  private anchorDate = computed(() => {
    if (this.mode() === 'range') {
      const range = this.rangeValue();

      return range.start ?? range.end ?? this.startAt() ?? this.today;
    }

    return this.value() ?? this.startAt() ?? this.today;
  });

  public visibleMonth = computed(() => startOfMonth(this.activeMonth() ?? this.anchorDate()));

  /** Value identity of the visible month, for template keying. */
  public visibleMonthKey = computed(() => this.visibleMonth().getTime());

  /** The year the month grid shows — the visible month's. */
  public visibleYear = computed(() => startOfYear(this.visibleMonth()));

  /**
   * First year of the year grid's visible page. Pages tile from `min`'s year when there is one, so a
   * bounded calendar opens its page on the bound instead of somewhere inside it.
   */
  public multiYearPageStart = computed(() => multiYearPageStart(this.visibleMonth(), this.min()?.getFullYear() ?? 0));

  /** Value identity of the unit the current view shows — the month, the year, or the year page. */
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
   * How the grid last changed — drives the transition styling. Chronological for a step within one view,
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
      default:
        return this.visibleMonthLabel();
    }
  });

  /** The dates a cell can read itself as selected from: the value, or the range's ends. */
  private selectedDates = computed<Date[]>(() => {
    if (this.mode() === 'range') {
      const { start, end } = this.rangeValue();

      return [start, end].filter((date): date is Date => date !== null);
    }

    const value = this.value();

    return value === null ? [] : [value];
  });

  /** Reused per coarse cell, so the day scan reads the bounds and the filter from one place. */
  private availability = computed<CalendarAvailability>(() => ({
    min: this.min(),
    max: this.max(),
    isDateSelectable: (date: Date) => !this.isDateDisabled(date),
  }));

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
          label: `${getDate(date)}`,
          ariaLabel: format(date, 'PPPP', labelOptions),
          classes: this.resolveCellClasses(date, 'month'),
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

  /** The 12 months of the visible year, as rows of four — the month grid's cells. */
  public monthCells = computed<CalendarCellBase[][]>(() => {
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const focused = this.focusedDate();
    const selected = this.selectedDates();

    return generateYearGrid(this.visibleYear()).map((row) =>
      row.map((month) => ({
        date: month,
        label: format(month, 'LLL', labelOptions),
        ariaLabel: format(month, 'LLLL yyyy', labelOptions),
        classes: this.resolveCellClasses(month, 'year'),
        disabled: this.isMonthDisabled(month),
        today: isSameMonth(month, this.today),
        selected: selected.some((date) => isSameMonth(date, month)),
        rangeStart: false,
        rangeEnd: false,
        inRange: false,
        inHoverPreview: false,
        band: null,
        focused: isSameMonth(month, focused),
      })),
    );
  });

  /** The years of the visible page, as rows of four — the year grid's cells. */
  public yearCells = computed<CalendarCellBase[][]>(() => {
    const locale = this.effectiveLocale();
    const labelOptions = locale ? { locale } : undefined;
    const focused = this.focusedDate();
    const selected = this.selectedDates();

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
          selected: selected.some((date) => isSameYear(date, year)),
          rangeStart: false,
          rangeEnd: false,
          inRange: false,
          inHoverPreview: false,
          band: null,
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

  /** Whether the header can zoom out any further — false only once the year grid is showing. */
  public canZoomOut = computed(() => this.view() !== 'multiYear');

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

  /** Whether the month holds no selectable day at all — what disables its cell in the month grid. */
  public isMonthDisabled(month: Date) {
    return !hasSelectableDayIn({ start: startOfMonth(month), end: endOfMonth(month) }, this.availability());
  }

  /** Whether the year holds no selectable day at all — what disables its cell in the year grid. */
  public isYearDisabled(year: Date) {
    return !hasSelectableDayIn({ start: startOfYear(year), end: endOfYear(year) }, this.availability());
  }

  /**
   * Activates the focused cell of whichever view is showing: picks the date in the day grid, drills into
   * the picked month or year otherwise. Coarse picks navigate — they never write a value.
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

  /**
   * Drills into a month from the month grid. The value is left alone: the reader narrowed down where to
   * look, they have not picked a date yet.
   */
  public selectMonth(date: Date) {
    const month = startOfMonth(date);

    if (this.isMonthDisabled(month)) {
      return;
    }

    this.monthSelect.emit(month);
    this.activeMonth.set(month);
    this.view.set('month');
  }

  /** Drills into a year from the year grid, keeping the month the reader was on. */
  public selectYear(date: Date) {
    const year = startOfYear(date);

    if (this.isYearDisabled(year)) {
      return;
    }

    this.yearSelect.emit(year);
    this.activeMonth.set(setYear(this.visibleMonth(), year.getFullYear()));
    this.view.set('year');
  }

  /**
   * Zooms the grid out one level — day grid → month grid → year grid — which is what the header label
   * does. From the year grid, which has nothing coarser above it, it returns to the day grid, so the
   * header is never a dead end for a reader who opened it by accident.
   */
  public zoomOut() {
    switch (this.view()) {
      case 'month':
        return this.view.set('year');
      case 'year':
        return this.view.set('multiYear');
      default:
        return this.view.set('month');
    }
  }

  /** Steps the visible unit forwards — a month, a year, or a year page, depending on the view. */
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

  /** The unit one step away in the current view — what the nav guards test against the bounds. */
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
        const stepped = addMonths(month, step);

        return { start: startOfMonth(stepped), end: endOfMonth(stepped) };
      }
    }
  }

  private moveFocus(date: Date) {
    const day = startOfDay(date);

    // the visible unit follows the roving focus out of itself — in every view, since the focused date
    // stays a full date and only the step size differs
    if (!this.isInVisibleUnit(day)) {
      this.activeMonth.set(startOfMonth(day));
    }

    this.focusedDate.set(day);
  }

  /** Whether a date falls inside the unit the current view is showing. */
  private isInVisibleUnit(date: Date) {
    switch (this.view()) {
      case 'year':
        return isSameYear(date, this.visibleYear());
      case 'multiYear':
        return isInMultiYearPage(date, this.multiYearPageStart());
      default:
        return isSameMonth(date, this.visibleMonth());
    }
  }
}
