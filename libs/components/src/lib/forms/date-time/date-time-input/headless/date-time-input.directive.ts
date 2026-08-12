import { booleanAttribute, computed, input, signal, Directive } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { withTimeOfDay } from '../../internals/date-time-merge';
import { parseDateTimeText } from '../../internals/date-time-parse';
import { createPendingDateTime, renderPartialDateTime } from '../../internals/pending-date-time';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { CalendarDateClassFn, CalendarView } from '../../../../calendar/headless';

/**
 * A combined date & time form control with a `string | null` value (a date-fns
 * `valueFormat` wire string, ISO by default). Typed entry parses strictly
 * against the combined `displayFormat` on blur/Enter, then leniently (date and
 * time split at any separator, bare dates commit at midnight); the anchored
 * picker overlay hosts a calendar and a time picker side by side and stays open
 * across picks. String↔`Date` conversion happens exclusively here - calendar
 * and time picker only ever see `Date` objects.
 *
 * Picking is two half-picks: whichever half lands first is held (the field renders it against
 * placeholders for the other) and the value stays `null` until the second one arrives, so a day
 * never invents a midnight nobody chose.
 */
@Directive({
  selector: '[etDateTimeInput]',
  exportAs: 'etDateTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateTimeInputDirective }],
})
export class DateTimeInputDirective extends DatePickerInputDirective implements FormValueControl<string | null> {
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when typed text can't be parsed as a date & time. */
  public parseErrorMessage = input<string | null>(null);

  /** Combined date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('Pp');

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

  /**
   * Forwarded to the picker's time picker. Only the time of day of `minTime`/`maxTime`
   * is read, so the bound applies on every day; `timeFilter` receives the full candidate
   * timestamp (the picked time of day on the committed day), so opening hours can differ
   * per weekday. Bounds shape the picker - validate typed entry with a schema validator,
   * exactly like `minDate`/`maxDate`.
   */
  public minTime = input<Date | null>(null);
  public maxTime = input<Date | null>(null);
  public timeFilter = input<((date: Date) => boolean) | null>(null);

  /** No precision to derive from here - the input is the format in effect. */
  public effectiveDisplayFormat = this.displayFormat;

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDateTime);

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

  private halfPick = createPendingDateTime();

  /** The day the picker calendar highlights - the committed one, else a day picked with no time yet. */
  public pickerDate = computed(() => this.dateTime() ?? this.halfPick.day());

  /** The time the picker's columns mark as selected - the committed one, else a time picked with no day yet. */
  public pickerTime = computed(() => this.dateTime() ?? this.halfPick.time());

  /** The committed value rendered in `displayFormat`, or a half-pick rendered against placeholders. */
  public displayValue = computed(() => {
    const dateTime = this.dateTime();

    if (dateTime !== null) {
      return formatDateValue(dateTime, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
    }

    // a typing mask owns the field text and draws its own guides - a second set of placeholders
    // would not survive its reconciliation anyway
    if (this.maskPattern() !== null) {
      return '';
    }

    return (
      renderPartialDateTime({
        day: this.halfPick.day(),
        time: this.halfPick.time(),
        format: this.displayFormat(),
        locale: this.effectiveLocale(),
      }) ?? ''
    );
  });

  /**
   * @internal Commits typed field text: empty clears, a strict-then-lenient
   * parse writes the value, anything else keeps the raw text and raises
   * `parseError` (the value stays `null`).
   */
  public commitInput(raw: string) {
    // blurring a field nobody typed in is not an edit - and while a half-pick is on screen its
    // placeholder text is not something to parse
    if (raw === this.displayValue()) {
      return;
    }

    this.halfPick.clear();

    if (!raw.trim()) {
      this.inputText.set('');
      this.parseError.set(false);

      // while mixed the field is empty anyway - a blank commit is a plain blur, not a user
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
   * Commits a calendar-picked day onto the committed time of day, or holds it until a time is
   * picked. The picker stays open - the user likely still wants to pick that time.
   */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();

    this.resolvePick(current === null ? this.halfPick.holdDay(date) : withTimeOfDay(date, current));
  }

  /**
   * Commits a picker-selected time onto the committed day, or holds it until a day is picked. The
   * picker stays open - a time takes one selection per column.
   */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();

    this.resolvePick(current === null ? this.halfPick.holdTime(time) : withTimeOfDay(current, time));
  }

  /** Drops a held half along with the value - the two are one control state. */
  public override clearValue() {
    super.clearValue();
    this.halfPick.clear();
  }

  /** Commits a completed pick, or settles the control around a half that is still waiting. */
  private resolvePick(dateTime: Date | null) {
    if (dateTime !== null) {
      this.commitDateTime(dateTime);
    } else if (this.mixed()) {
      // a half-pick resolves the bulk-edit mask like any other pick: replace, never merge into
      // the hidden raw value
      this.value.set(null);
      this.mixed.set(false);
    }

    this.touched.set(true);
  }

  private commitDateTime(dateTime: Date) {
    this.halfPick.clear();
    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(dateTime, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.mixed.set(false);
  }
}
