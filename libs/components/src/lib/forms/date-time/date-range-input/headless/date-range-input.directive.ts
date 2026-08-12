import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { CalendarPrecision, CalendarRangeSelectionStrategy, startOfCalendarUnit } from '../../../../calendar/headless';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { DateRangePickerInputDirective, DateRangeValue } from '../../internals/date-range-picker-input.directive';
import { parseDateValue } from '../../internals/date-value';
import { displayFormatForPrecision } from '../../internals/precision-format';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';

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

  /** Message the form field shows when either side's typed text can't be parsed as a date. */
  public parseErrorMessage = input<string | null>(null);

  /**
   * date-fns format shown in (and parsed from) the fields. Unset, it follows `precision`: the
   * locale's short date at day precision, that same pattern without its day at month precision
   * (`MM.yyyy`), the year alone at year precision.
   */
  public displayFormat = input<string | null>(null);

  /**
   * How precise the two dates are - `'month'` makes this a month range (`07/2025 – 03/2026`), a
   * real reporting filter. Both ends are the start of their unit, and the picker calendar selects
   * and bands in the grid holding it.
   */
  public precision = input<CalendarPrecision>('day');

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

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDateRange);

  /** The format in effect: this instance's `displayFormat`, else the one `precision` implies. */
  public effectiveDisplayFormat = computed(
    () => this.displayFormat() ?? displayFormatForPrecision(this.precision(), this.effectiveLocale()),
  );

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_RANGE_INPUT);

  /** Commits a picker range; a completed range closes the picker. */
  public selectCalendarRange(range: { start: Date | null; end: Date | null }) {
    if (!this.interactive()) {
      return;
    }

    const precision = this.precision();
    const unitStart = (date: Date | null) => (date === null ? null : startOfCalendarUnit(date, precision));

    this.writeRange({ start: unitStart(range.start), end: unitStart(range.end) });

    if (range.start !== null && range.end !== null) {
      this.touched.set(true);
      this.closePicker();
    }
  }

  public parseSideCommit(raw: string) {
    // reference midnight so a date-only `displayFormat` doesn't fold the current wall-clock
    // time into a time-bearing `valueFormat` - see the note in date-input's `commitInput`.
    const parsed = parseDateValue(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });

    if (parsed === null) {
      return null;
    }

    // the unit start, so a typed month and a picked month are one value - see date-input's `writeDate`
    return startOfCalendarUnit(parsed, this.precision());
  }
}
