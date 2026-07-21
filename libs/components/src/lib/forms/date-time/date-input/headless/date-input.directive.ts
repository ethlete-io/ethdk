import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';

/**
 * A date form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, ISO by default). Typed entry parses strictly against
 * `displayFormat` on blur/Enter; the anchored picker overlay hosts a calendar.
 * String↔`Date` conversion happens exclusively here — the calendar itself
 * only ever sees `Date` objects.
 */
@Directive({
  selector: '[etDateInput]',
  exportAs: 'etDateInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateInputDirective }],
})
export class DateInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when typed text can't be parsed as a date. */
  public parseErrorMessage = input('Please enter a valid date');

  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('P');

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_INPUT);

  /** The current value as a `Date` (what the picker calendar binds to). */
  public date = computed(() => {
    // masking: while mixed the hidden raw value is neither rendered in the field
    // (displayValue derives from here) nor highlighted in the picker calendar
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
    const date = this.date();

    if (date === null) {
      return '';
    }

    return formatDateValue(date, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /**
   * @internal Commits typed field text: empty clears, a strict `displayFormat`
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

    // reference midnight, not `new Date()`: a date-only `displayFormat` leaves date-fns to
    // fill H/M/S from the reference, so without this a typed day would carry the current
    // wall-clock time into a time-bearing `valueFormat` while the same day picked in the
    // calendar (startOfDay) would not — two entry paths, two wire values for one date.
    const parsed = parseDateValue(raw, {
      format: this.displayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });

    if (parsed === null) {
      this.inputText.set(raw);
      this.parseError.set(true);

      // a failed parse resolves nothing: mixed stays set and the masked raw value untouched
      if (!this.mixed() && this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(parsed, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
  }

  /** Commits a picker-selected date and closes the picker. */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(date, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
    this.touched.set(true);
    this.closePicker();
  }
}
