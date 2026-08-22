import { booleanAttribute, computed, effect, input, signal, Directive } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import { DatePickerInputDirective } from '../../internals/date-picker-input.directive';
import { parseDateValue } from '../../internals/date-value';
import {
  formatInZone,
  isValidTimeZone,
  localReading,
  reinterpretInZone,
  timeZoneDisplayName,
  withZonedDay,
  withZonedTimeOfDay,
  zonedProxy,
} from '../../internals/time-zone';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';
import { withTimeOfDay } from '../../internals/date-time-merge';
import { parseDateTimeText } from '../../internals/date-time-parse';
import { createPendingDateTime, renderPartialDateTime } from '../../internals/pending-date-time';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { CalendarDateClassFn, CalendarView } from '../../../../calendar/headless';

let localReadingIdCounter = 0;

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

  /**
   * IANA name of the zone the field's wall clock stands for - `'Asia/Tokyo'` makes the field, the
   * calendar and the time picker all read in Tokyo, and writes the value with Tokyo's offset. The
   * value stays an instant either way. `null` keeps the runtime's own zone.
   */
  public timeZone = input<string | null>(null);

  /** A name for {@link timeZone} in the second reading. Defaults to the IANA name's last segment. */
  public timeZoneLabel = input<string | null>(null);

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

  /** The zone in effect, or `null` when none is set or the name is not one `Intl` knows. */
  public effectiveTimeZone = computed(() => {
    const timeZone = this.timeZone();

    return timeZone !== null && isValidTimeZone(timeZone) ? timeZone : null;
  });

  /** The name shown for the field's zone. */
  public resolvedTimeZoneLabel = computed(() => {
    const timeZone = this.effectiveTimeZone();

    return timeZone === null ? null : (this.timeZoneLabel() ?? timeZoneDisplayName(timeZone));
  });

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

  /**
   * The committed value as the calendar and the time picker see it: a plain `Date` whose local wall
   * clock is the zone's, so both keep doing local arithmetic. Highlighting only - a committed value
   * is always derived from the instant, never from this. See `zonedProxy`.
   */
  private pickerDateTime = computed(() => {
    const dateTime = this.dateTime();
    const timeZone = this.effectiveTimeZone();

    return dateTime === null || timeZone === null ? dateTime : zonedProxy(dateTime, timeZone);
  });

  /** The day the picker calendar highlights - the committed one, else a day picked with no time yet. */
  public pickerDate = computed(() => this.pickerDateTime() ?? this.halfPick.day());

  /** The time the picker's columns mark as selected - the committed one, else a time picked with no day yet. */
  public pickerTime = computed(() => this.pickerDateTime() ?? this.halfPick.time());

  /**
   * The same moment read in the runtime's own zone, or `null` when no zone is set, the field is
   * empty, or both zones show the same wall clock.
   */
  public localReading = computed(() =>
    localReading(this.dateTime(), {
      format: this.displayFormat(),
      locale: this.effectiveLocale(),
      timeZone: this.effectiveTimeZone(),
    }),
  );

  private readonly LOCAL_READING_ELEMENT_ID = `et-date-time-local-reading-${localReadingIdCounter++}`;

  /** @internal Id of the second-reading element, or `null` while it does not render. */
  public localReadingId = computed(() => (this.localReading() === null ? null : this.LOCAL_READING_ELEMENT_ID));

  public override ownDescribedBy = this.localReadingId;

  /** The committed value rendered in `displayFormat`, or a half-pick rendered against placeholders. */
  public displayValue = computed(() => {
    const dateTime = this.dateTime();

    if (dateTime !== null) {
      return (
        formatInZone(dateTime, {
          format: this.displayFormat(),
          locale: this.effectiveLocale(),
          timeZone: this.effectiveTimeZone(),
        }) ?? ''
      );
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

  constructor() {
    super();

    if (ngDevMode) {
      // an unknown zone name silently behaving like no zone at all would be a head-scratcher
      effect(() => {
        const timeZone = this.timeZone();

        if (timeZone !== null && !isValidTimeZone(timeZone)) {
          console.warn(`[et-date-time-input] timeZone "${timeZone}" is not an IANA zone name, so it is ignored.`);
        }
      });
    }
  }

  /** An actual edit invalidates whatever half was held. */
  public override beforeCommit() {
    this.halfPick.clear();
  }

  /** @internal A strict parse against `displayFormat`, then a lenient one. */
  public parseCommitText(raw: string) {
    return parseDateTimeText(raw, { format: this.displayFormat(), locale: this.effectiveLocale() });
  }

  /** @internal */
  public writeCommitted(parsed: Date) {
    this.commitInstant(reinterpretInZone(parsed, this.effectiveTimeZone()));
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
    const timeZone = this.effectiveTimeZone();

    if (current !== null) {
      this.resolvePick(
        timeZone === null ? withTimeOfDay(date, current) : withZonedDay(current, { day: date, timeZone }),
      );

      return;
    }

    this.resolvePick(this.holdHalfPick(this.halfPick.holdDay(date)));
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
    const timeZone = this.effectiveTimeZone();

    if (current !== null) {
      this.resolvePick(
        timeZone === null ? withTimeOfDay(current, time) : withZonedTimeOfDay(current, { time, timeZone }),
      );

      return;
    }

    this.resolvePick(this.holdHalfPick(this.halfPick.holdTime(time)));
  }

  /** Drops a held half along with the value - the two are one control state. */
  public override clearValue() {
    super.clearValue();
    this.halfPick.clear();
  }

  /** A completed half-pick carries the wall clock the user picked, so it is read in the field's zone. */
  private holdHalfPick(merged: Date | null) {
    return merged === null ? null : reinterpretInZone(merged, this.effectiveTimeZone());
  }

  /** Commits a completed pick, or settles the control around a half that is still waiting. */
  private resolvePick(instant: Date | null) {
    if (instant !== null) {
      this.commitInstant(instant);
    } else if (this.mixed()) {
      // a half-pick resolves the bulk-edit mask like any other pick: replace, never merge into
      // the hidden raw value
      this.value.set(null);
      this.mixed.set(false);
    }

    this.touched.set(true);
  }

  private commitInstant(instant: Date) {
    this.halfPick.clear();
    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(
      formatInZone(instant, {
        format: this.effectiveValueFormat(),
        locale: this.effectiveLocale(),
        timeZone: this.effectiveTimeZone(),
      }),
    );
    this.mixed.set(false);
  }
}
