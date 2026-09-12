import { booleanAttribute, computed, input, signal, Directive } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import {
  CalendarDateClassFn,
  CalendarPrecision,
  CalendarView,
  startOfCalendarUnit,
} from '../../../../calendar/headless';
import { displayFormatForPrecision } from '../../internals/precision-format';

/**
 * A date form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, ISO by default). Typed entry parses strictly against
 * `displayFormat` on blur/Enter; the anchored picker overlay hosts a calendar.
 */
@Directive({
  selector: '[etDateInput]',
  exportAs: 'etDateInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateInputDirective }],
})
export class DateInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when typed text can't be parsed as a date. */
  public parseErrorMessage = input<string | null>(null);

  /**
   * date-fns format shown in (and parsed from) the field. Unset, it follows
   * `precision`: the locale's short date at day precision, that same pattern
   * without its day at month precision (`MM.yyyy`), the year alone at year
   * precision.
   */
  public displayFormat = input<string | null>(null);

  /**
   * How precise a date this field takes - `'month'` makes it a month picker,
   * `'year'` a year picker. The value is the start of the unit, the mask and
   * placeholder follow the derived format, and the picker calendar selects in
   * the grid holding that unit.
   */
  public precision = input<CalendarPrecision>('day');

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);
  /** Month the picker calendar opens at while the value is empty. */
  public startAt = input<Date | null>(null);

  /** Which grid the picker calendar opens on - `'year'` to pick a month first, `'multiYear'` a year. */
  public startView = input<CalendarView>('month');

  /** Per-cell classes for the picker calendar - busy days, holidays, markers of your own. */
  public dateClass = input<CalendarDateClassFn | null>(null);

  /** Renders the picker calendar's week-number column. */
  public weekNumbers = input(false, { transform: booleanAttribute });

  /** The format in effect: this instance's `displayFormat`, else the one `precision` implies. */
  public effectiveDisplayFormat = computed(
    () => this.displayFormat() ?? displayFormatForPrecision(this.precision(), this.effectiveLocale()),
  );

  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDate);

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_INPUT);

  /** The current value as a `Date` (what the picker calendar binds to). */
  public date = computed(() => {
    if (this.mixed()) {
      return null;
    }

    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  });

  /** The committed value rendered in the format in effect. */
  public displayValue = computed(() => {
    const date = this.date();

    if (date === null) {
      return '';
    }

    return formatDateValue(date, { format: this.effectiveDisplayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /** @internal A strict parse against `displayFormat`. */
  public parseCommitText(raw: string) {
    // reference midnight, not `new Date()`: a date-only `displayFormat` leaves date-fns to fill
    // H/M/S from the reference, so a typed day would otherwise carry the current wall-clock time
    // into a time-bearing `valueFormat`.
    return parseDateValue(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });
  }

  /** Commits a picker-selected date and closes the picker. */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.writeCommitted(date);
    this.touched.set(true);
    this.closePicker();
  }

  /**
   * Writes the wire value, at the start of `precision`'s unit - a coarse format cannot say which day
   * it meant, so normalizing here makes a typed month and a picked month the same value.
   */
  public writeCommitted(date: Date) {
    const unitStart = startOfCalendarUnit(date, this.precision());

    this.value.set(formatDateValue(unitStart, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
  }
}
