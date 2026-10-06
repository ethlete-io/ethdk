import { Directive, booleanAttribute, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import {
  CalendarDateClassFn,
  CalendarPrecision,
  CalendarRangeSelectionStrategy,
  CalendarView,
  startOfCalendarUnit,
  CalendarWeekStartsOn,
} from '../../../../calendar/headless';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DateRangePickerInputDirective, DateRangeValue } from '../../internals/date-range-picker-input.directive';
import { parseDateValue } from '../../internals/date-value';
import { displayFormatForPrecision } from '../../internals/precision-format';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { DateRangePreset } from '../../date-range-presets';
import { createDateRangePresets } from '../../internals/date-range-presets-state';
import { warnOnUnparsedValue } from '../../internals/unparsed-value-warning';
import { reinterpretInZone, toZoneCalendar } from '../../internals/time-zone';
import { effectiveTimeZoneOf } from '../../internals/time-zone-state';

export type { DateRangeSide, DateRangeValue } from '../../internals/date-range-picker-input.directive';

/**
 * A date range form control: one registered field-control containing two text
 * inputs that share a single range-mode calendar picker. The value is
 * `{ start, end }` of `valueFormat` wire strings; each side parses strictly
 * against `displayFormat` on blur/Enter, exactly like the single date input.
 */
@Directive({
  selector: '[etDateRangeInput]',
  exportAs: 'etDateRangeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateRangeInputDirective }],
})
export class DateRangeInputDirective extends DateRangePickerInputDirective implements FormValueControl<DateRangeValue> {
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when either side's typed text can't be parsed as a date. */
  public parseErrorMessage = input<string | null>(null);

  /**
   * date-fns format shown in (and parsed from) the fields. Unset, it follows `precision`: the
   * locale's short date at day precision, that same pattern without its day at month precision
   * (`MM.yyyy`), the year alone at year precision.
   */
  public displayFormat = input<string | null>(null);

  /**
   * How precise the two dates are - `'month'` makes this a month range (`07/2025 – 03/2026`). Both
   * ends are the start of their unit, and the picker calendar selects and bands in the grid holding it.
   */
  public precision = input<CalendarPrecision>('day');

  /**
   * IANA name of the zone whose calendar both fields read and write. A `valueFormat` with a time or
   * offset is read in that zone, and each end is written as its day's midnight there; the default
   * `yyyy-MM-dd` names the same day in every zone. Unset, it follows `provideDateTimeZone()`; `null`
   * keeps the runtime's own zone.
   */
  public timeZone = input<string | null | undefined>(undefined);

  /**
   * What a pick means in the picker calendar - snap to whole weeks, take a fixed number of days.
   * Unset, the usual open-then-close rule applies.
   */
  public rangeSelectionStrategy = input<CalendarRangeSelectionStrategy | null>(null);

  /**
   * A period to band behind the selected range in the picker - "vs. the previous 30 days". Purely
   * presentational: it never enters the value and its cells stay selectable.
   */
  public comparisonStart = input<Date | null>(null);
  public comparisonEnd = input<Date | null>(null);

  /**
   * Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) With a
   * {@link timeZone}, the bounds are read on the zone's calendar.
   */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);
  /** Month the picker calendar opens at while the range is empty. */
  public startAt = input<Date | null>(null);

  /** Which grid the picker calendar opens on - `'year'` to pick a month first, `'multiYear'` a year. */
  public startView = input<CalendarView>('month');

  /** Per-cell classes for the picker calendar - busy days, holidays, markers of your own. */
  public dateClass = input<CalendarDateClassFn | null>(null);

  /** Renders the picker calendar's week-number column. */
  public weekNumbers = input(false, { transform: booleanAttribute });

  /** The first day of the picker calendar's rows, `0` for Sunday. Defaults to the locale's. */
  public firstDayOfWeek = input<CalendarWeekStartsOn | undefined>(undefined);

  /**
   * Ranges offered beside the picker calendar - build them with the preset factories
   * (`lastDaysPreset(7)`, `thisMonthPreset()`, …) or write your own. Picking one commits it and
   * closes the picker.
   */
  public presets = input<readonly DateRangePreset[]>([]);

  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDateRange);

  /** The zone in effect, or `null` when none is set or the name is not one `Intl` knows. */
  public override effectiveTimeZone = effectiveTimeZoneOf(this.timeZone, 'et-date-range-input');

  /** The range the picker calendar highlights: both ends on the zone's calendar. */
  public pickerDateRange = computed(() => ({ start: this.pickerSideDate('start'), end: this.pickerSideDate('end') }));

  /** {@link minDate} on the calendar the picker shows. */
  public pickerMinDate = computed(() => toZoneCalendar(this.minDate(), this.effectiveTimeZone()));

  /** {@link maxDate} on the calendar the picker shows. */
  public pickerMaxDate = computed(() => toZoneCalendar(this.maxDate(), this.effectiveTimeZone()));

  /** @internal */
  public presetList = createDateRangePresets({
    host: this,
    presets: this.presets,
    labels: this.dateTimeLabels,
    normalize: (date) => startOfCalendarUnit(date, this.precision()),
  });

  /** The format in effect: this instance's `displayFormat`, else the one `precision` implies. */
  public effectiveDisplayFormat = computed(
    () => this.displayFormat() ?? displayFormatForPrecision(this.precision(), this.effectiveLocale()),
  );

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_RANGE_INPUT);

  constructor() {
    super();

    warnOnUnparsedValue({
      selector: 'et-date-range-input',
      formatProvider: 'provideDateFormat',
      readings: () =>
        this.mixed()
          ? []
          : [
              { value: this.value().start, parsed: this.startDate() },
              { value: this.value().end, parsed: this.endDate() },
            ],
      format: this.effectiveValueFormat,
      locale: this.effectiveLocale,
    });
  }

  /** Commits a picker range; a completed range closes the picker. */
  public selectCalendarRange(range: { start: Date | null; end: Date | null }) {
    if (!this.interactive()) {
      return;
    }

    const unitStart = (date: Date | null) => (date === null ? null : this.toZonedUnitStart(date));

    this.writeRange({ start: unitStart(range.start), end: unitStart(range.end) });

    if (range.start !== null && range.end !== null) {
      this.touched.set(true);
      this.closePicker();
    }
  }

  /** Commits a preset's range and closes the picker. */
  public selectPreset(preset: DateRangePreset) {
    if (this.presetList.apply(preset)) {
      this.closePicker();
    }
  }

  public parseSideCommit(raw: string) {
    const parsed = parseDateValue(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });

    return parsed === null ? null : this.toZonedUnitStart(parsed);
  }

  /** A day on the picker's calendar as the start of its `precision` unit in the zone. */
  private toZonedUnitStart(date: Date) {
    return reinterpretInZone(startOfCalendarUnit(date, this.precision()), this.effectiveTimeZone());
  }
}
