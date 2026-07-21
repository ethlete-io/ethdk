import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectTimeFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { parseTimeText } from './internals/time-parse';

/**
 * A time form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, `HH:mm` by default). Typed entry parses leniently on blur/Enter
 * (`930` → 09:30); the anchored picker overlay hosts a time picker and stays
 * open across part picks. String↔`Date` conversion happens exclusively here —
 * the time picker itself only ever sees `Date` objects.
 */
@Directive({
  selector: '[etTimeInput]',
  exportAs: 'etTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: TimeInputDirective }],
})
export class TimeInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  public defaultValueFormat = injectTimeFormat();

  /** Message the form field shows when typed text can't be parsed as a time. */
  public parseErrorMessage = input('Please enter a valid time');

  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('p');

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TIME_INPUT);

  // parses fill missing units (the date, unentered seconds) from here instead of "now"
  private referenceDate = startOfDay(new Date());

  /** The current value as a `Date` (what the picker binds to). */
  public time = computed(() => {
    // masking: while mixed the hidden raw value is neither rendered in the field
    // (displayValue derives from here) nor highlighted in the time picker
    if (this.mixed()) {
      return null;
    }

    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, {
      format: this.effectiveValueFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
    });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const time = this.time();

    if (time === null) {
      return '';
    }

    return formatDateValue(time, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
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

    const parsed = parseTimeText(raw, {
      format: this.displayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
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

  /**
   * Commits a picker-selected time. The picker stays open — picking a time
   * takes one selection per column.
   */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(time, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
    this.touched.set(true);
  }
}
