import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { parseDateTimeText } from './internals/date-time-parse';

/**
 * A combined date & time form control with a `string | null` value (a date-fns
 * `valueFormat` wire string, ISO by default). Typed entry parses strictly
 * against the combined `displayFormat` on blur/Enter, then leniently (date and
 * time split at any separator, bare dates commit at midnight); the anchored
 * picker overlay hosts a calendar and a time picker side by side and stays open
 * across picks. String↔`Date` conversion happens exclusively here — calendar
 * and time picker only ever see `Date` objects.
 */
@Directive({
  selector: '[etDateTimeInput]',
  exportAs: 'etDateTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateTimeInputDirective }],
})
export class DateTimeInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when typed text can't be parsed as a date & time. */
  public parseErrorMessage = input('Please enter a valid date and time');

  /** Combined date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('Pp');

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_TIME_INPUT);

  /** The current value as a `Date` (what the picker calendar and time picker bind to). */
  public dateTime = computed(() => {
    // masking: while mixed the hidden raw value is neither rendered in the field
    // (displayValue derives from here) nor highlighted in the calendar/time picker.
    // selectDate/selectTime read this too, so a resolving pick starts from scratch
    // (replace semantics) instead of merging with the hidden date or time of day
    if (this.mixed()) {
      return null;
    }

    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const dateTime = this.dateTime();

    if (dateTime === null) {
      return '';
    }

    return formatDateValue(dateTime, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /**
   * @internal Commits typed field text: empty clears, a strict-then-lenient
   * parse writes the value, anything else keeps the raw text and raises
   * `parseError` (the value stays `null`).
   */
  public commitInput(raw: string) {
    if (!raw.trim()) {
      this.inputText.set('');
      this.parseError.set(false);

      // while mixed the field is empty anyway — a blank commit is a plain blur, not a user
      // clear, so the hidden raw value survives (the clear affordance resolves instead)
      if (this.mixed()) {
        return;
      }

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    const parsed = parseDateTimeText(raw, { format: this.displayFormat(), locale: this.effectiveLocale() });

    if (parsed === null) {
      this.inputText.set(raw);
      this.parseError.set(true);

      // a failed parse resolves nothing: mixed stays set and the masked raw value untouched
      if (!this.mixed() && this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.commitDateTime(parsed);
  }

  /**
   * Commits a calendar-picked day, keeping the committed time of day (midnight
   * while there is none yet). The picker stays open — the user likely still
   * wants to pick a time.
   */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();
    const day = startOfDay(date);

    this.commitDateTime(
      current === null
        ? day
        : setSeconds(setMinutes(setHours(day, current.getHours()), current.getMinutes()), current.getSeconds()),
    );
    this.touched.set(true);
  }

  /**
   * Commits a picker-selected time onto the committed day (the picked time's
   * own day — today — while there is none yet). The picker stays open — a time
   * takes one selection per column.
   */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();
    const day = startOfDay(current ?? time);

    this.commitDateTime(setSeconds(setMinutes(setHours(day, time.getHours()), time.getMinutes()), time.getSeconds()));
    this.touched.set(true);
  }

  private commitDateTime(dateTime: Date) {
    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(dateTime, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
  }
}
