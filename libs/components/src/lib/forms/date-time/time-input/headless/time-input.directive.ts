import { Directive, computed, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectTimeFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { parseTimeText, timeReferenceDay } from '../../internals/time-parse';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { warnOnUnparsedValue } from '../../internals/unparsed-value-warning';

/**
 * A time form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, `HH:mm` by default). Typed entry parses leniently on blur/Enter
 * (`930` → 09:30); the anchored picker overlay hosts a time picker and stays
 * open across part picks.
 */
@Directive({
  selector: '[etTimeInput]',
  exportAs: 'etTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: TimeInputDirective }],
})
export class TimeInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectTimeFormat();

  /** Message the form field shows when typed text can't be parsed as a time. */
  public parseErrorMessage = input<string | null>(null);

  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input<string | null>(null);

  /**
   * Forwarded to the picker's time picker. (`min`/`max` are reserved by signal forms.)
   * Only the time of day of `minTime`/`maxTime` is read; `timeFilter` receives the full
   * candidate timestamp. Bounds shape the picker - validate typed entry with `timeBounds`.
   */
  public minTime = input<Date | null>(null);
  public maxTime = input<Date | null>(null);
  public timeFilter = input<((date: Date) => boolean) | null>(null);

  /** The format in effect: this instance's `displayFormat`, else `'p'`. */
  public effectiveDisplayFormat = computed(() => this.displayFormat() ?? 'p');

  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidTime);

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TIME_INPUT);

  private referenceDate = timeReferenceDay();

  /** The current value as a `Date` (what the picker binds to). */
  public time = computed(() => {
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

    return formatDateValue(time, { format: this.effectiveDisplayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  constructor() {
    super();

    warnOnUnparsedValue({
      selector: 'et-time-input',
      formatProvider: 'provideTimeFormat',
      readings: () => (this.mixed() ? [] : [{ value: this.value(), parsed: this.time() }]),
      format: this.effectiveValueFormat,
      locale: this.effectiveLocale,
    });
  }

  /** @internal A strict parse against `displayFormat`, then a lenient one. */
  public parseCommitText(raw: string) {
    return parseTimeText(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
    });
  }

  /** @internal */
  public writeCommitted(parsed: Date) {
    this.value.set(formatDateValue(parsed, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
  }

  /** Commits a picker-selected time. The picker stays open. */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.writeCommitted(time);
    this.touched.set(true);
  }
}
