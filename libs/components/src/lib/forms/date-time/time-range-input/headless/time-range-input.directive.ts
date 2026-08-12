import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectTimeFormat } from '../../date-time-formats';
import {
  DateRangePickerInputDirective,
  DateRangeSide,
  DateRangeValue,
} from '../../internals/date-range-picker-input.directive';
import { parseTimeText } from '../../internals/time-parse';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';

export type { DateRangeSide as TimeRangeInputSide } from '../../internals/date-range-picker-input.directive';
export type { DateRangeValue as TimeRangeValue } from '../../internals/date-range-picker-input.directive';

/**
 * Rejects individual times in the picker. The candidate is the picked time of day, and `side` says
 * which end is being filled - the hook for "the end must be after the start", which no single-value
 * bound can express.
 */
export type TimeRangeTimeFilterFn = (date: Date, side: DateRangeSide) => boolean;

/**
 * A time *range* form control: one registered field-control containing two text inputs that share a
 * single range-mode time picker. The value is `{ start, end }` of `valueFormat` wire strings (`HH:mm`
 * by default); each side parses leniently on blur/Enter (`930` → 09:30), exactly like the single time
 * input.
 *
 * The picker never closes on its own - filling one end still leaves the other to set.
 */
@Directive({
  selector: '[etTimeRangeInput]',
  exportAs: 'etTimeRangeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: TimeRangeInputDirective }],
})
export class TimeRangeInputDirective extends DateRangePickerInputDirective implements FormValueControl<DateRangeValue> {
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectTimeFormat();

  /** Message the form field shows when either side's typed text can't be parsed as a time. */
  public parseErrorMessage = input<string | null>(null);

  /** date-fns format shown in (and parsed from) both fields. Locale-aware by default. */
  public displayFormat = input('p');

  /**
   * Forwarded to the picker's time picker. (`min`/`max` are reserved by signal forms.) Only the time
   * of day of `minTime`/`maxTime` is read; `timeFilter` receives the candidate together with the side
   * it belongs to. Bounds shape the picker - validate typed entry with a schema validator, exactly
   * like the date inputs' `minDate`/`maxDate`.
   */
  public minTime = input<Date | null>(null);
  public maxTime = input<Date | null>(null);
  public timeFilter = input<TimeRangeTimeFilterFn | null>(null);

  /** No precision to derive from here - the input is the format in effect. */
  public effectiveDisplayFormat = this.displayFormat;

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidTimeRange);

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TIME_RANGE_INPUT);

  // parses fill the missing date (and unentered seconds) from here instead of "now", so both ends
  // land on the same day and a consumer `timeFilter` can compare them
  private referenceDate = startOfDay(new Date());

  /** Commits a picker-selected time onto one end. The picker stays open - the other end may follow. */
  public selectTime(side: DateRangeSide, time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    this.commitSideDate(side, time);
    this.touched.set(true);
  }

  public parseSideCommit(raw: string) {
    return parseTimeText(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
    });
  }
}
