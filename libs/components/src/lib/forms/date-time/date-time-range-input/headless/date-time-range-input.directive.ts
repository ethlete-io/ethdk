import { Directive, booleanAttribute, computed, effect, input, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { startOfDay } from 'date-fns';
import { CalendarDateClassFn, CalendarView } from '../../../../calendar/headless';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { FORM_FIELD_CONTROL_TYPES } from '../../../form-field/headless';
import { injectDateFormat } from '../../date-time-formats';
import {
  DateRangePickerInputDirective,
  DateRangeSide,
  DateRangeValue,
} from '../../internals/date-range-picker-input.directive';
import { withTimeOfDay } from '../../internals/date-time-merge';
import {
  isValidTimeZone,
  localReading,
  reinterpretInZone,
  timeZoneDisplayName,
  withZonedDay,
} from '../../internals/time-zone';
import { parseDateTimeText } from '../../internals/date-time-parse';
import { createPendingDateTime, renderPartialDateTime } from '../../internals/pending-date-time';
import { DATE_PICKER_HOST } from '../../picker/date-picker-host';

export type { DateRangeValue as DateTimeRangeValue } from '../../internals/date-range-picker-input.directive';

let localReadingIdCounter = 0;

/**
 * Rejects individual times in the picker. The candidate is the picked time of day on the side's
 * committed day, and `side` says which end is being filled - the hook for "the end must be after
 * the start", which no single-value bound can express.
 */
export type DateTimeRangeTimeFilterFn = (date: Date, side: DateRangeSide) => boolean;

/**
 * A combined date & time *range* form control: one registered field-control containing two text
 * inputs that share a single picker holding a range-mode calendar and one time picker per side. The
 * value is `{ start, end }` of `valueFormat` wire strings, both carrying a time; each side parses
 * strictly against the combined `displayFormat` on blur/Enter, then leniently, exactly like the
 * single date-time input.
 *
 * The picker never closes on its own - a completed day range is only half the range, so the reader
 * still has both times to set. Each side is picked in two halves: whichever half lands first is
 * held (the field renders it against placeholders for the other) and that side's value stays `null`
 * until the second one arrives, so a day never invents a midnight nobody chose.
 */
@Directive({
  selector: '[etDateTimeRangeInput]',
  exportAs: 'etDateTimeRangeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateTimeRangeInputDirective }],
})
export class DateTimeRangeInputDirective
  extends DateRangePickerInputDirective
  implements FormValueControl<DateRangeValue>
{
  private dateTimeLabels = injectDateTimeLabels();

  public defaultValueFormat = injectDateFormat();

  /** Message the form field shows when either side's typed text can't be parsed as a date & time. */
  public parseErrorMessage = input<string | null>(null);

  /** Combined date-fns format shown in (and parsed from) both fields. Locale-aware by default. */
  public displayFormat = input('Pp');

  /**
   * IANA name of the zone both fields' wall clock stands for - `'Asia/Tokyo'` makes the fields, the
   * calendar and the time pickers all read in Tokyo, and writes both ends with Tokyo's offset. The
   * values stay instants either way. `null` keeps the runtime's own zone.
   */
  public timeZone = input<string | null>(null);

  /** A name for {@link timeZone} in the second reading. Defaults to the IANA name's last segment. */
  public timeZoneLabel = input<string | null>(null);

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
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

  /**
   * Forwarded to both of the picker's time pickers. Only the time of day of `minTime`/`maxTime` is
   * read, so the bound applies on every day; `timeFilter` receives the full candidate timestamp and
   * the side it belongs to. Bounds shape the picker - validate typed entry with a schema validator,
   * exactly like `minDate`/`maxDate`.
   */
  public minTime = input<Date | null>(null);
  public maxTime = input<Date | null>(null);
  public timeFilter = input<DateTimeRangeTimeFilterFn | null>(null);

  /** No precision to derive from here - both ends carry a time. */
  public effectiveDisplayFormat = this.displayFormat;

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(
    () => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDateTimeRange,
  );

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_TIME_RANGE_INPUT);

  /** The zone in effect, or `null` when none is set or the name is not one `Intl` knows. */
  public override effectiveTimeZone = computed(() => {
    const timeZone = this.timeZone();

    return timeZone !== null && isValidTimeZone(timeZone) ? timeZone : null;
  });

  /** The name shown for the fields' zone. */
  public resolvedTimeZoneLabel = computed(() => {
    const timeZone = this.effectiveTimeZone();

    return timeZone === null ? null : (this.timeZoneLabel() ?? timeZoneDisplayName(timeZone));
  });

  private readonly LOCAL_READING_ELEMENT_ID = `et-date-time-range-local-reading-${localReadingIdCounter++}`;

  /** @internal Id of the second-reading element, or `null` while it does not render. */
  public localReadingId = computed(() =>
    this.localReading('start') === null && this.localReading('end') === null ? null : this.LOCAL_READING_ELEMENT_ID,
  );

  public override ownDescribedBy = this.localReadingId;

  private halfPicks = { start: createPendingDateTime(), end: createPendingDateTime() };

  /** The two days the picker calendar highlights - committed, else picked with no time yet. */
  public pickerDateRange = computed(() => ({
    start: this.pickerSideDate('start') ?? this.halfPicks.start.day(),
    end: this.pickerSideDate('end') ?? this.halfPicks.end.day(),
  }));

  /** The two times the picker's columns mark as selected - committed, else picked with no day yet. */
  public pickerTimeRange = computed(() => ({
    start: this.pickerSideDate('start') ?? this.halfPicks.start.time(),
    end: this.pickerSideDate('end') ?? this.halfPicks.end.time(),
  }));

  constructor() {
    super();

    if (ngDevMode) {
      // an unknown zone name silently behaving like no zone at all would be a head-scratcher
      effect(() => {
        const timeZone = this.timeZone();

        if (timeZone !== null && !isValidTimeZone(timeZone)) {
          console.warn(`[et-date-time-range-input] timeZone "${timeZone}" is not an IANA zone name, so it is ignored.`);
        }
      });
    }
  }

  /** One side read in the runtime's own zone, or `null` when it is empty or the readings agree. */
  public localReading(side: DateRangeSide) {
    return localReading(this.sideDate(side), {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      timeZone: this.effectiveTimeZone(),
    });
  }

  /**
   * Commits a picker day range onto each side's committed time of day, holding the days whose time
   * is still missing. The picker stays open - those times are still to come.
   */
  public selectCalendarRange(range: { start: Date | null; end: Date | null }) {
    if (!this.interactive()) {
      return;
    }

    // both merges read the value the range is about to replace, so they run before `writeRange`
    this.writeRange({ start: this.mergeDay(range.start, 'start'), end: this.mergeDay(range.end, 'end') });
    this.touched.set(true);
  }

  /**
   * Commits a picker-selected time onto one side's day. While that side has no day yet the *other*
   * side's is used - setting the end time of an appointment whose start day is known means that day
   * - and while the range is empty the time is held until a day is picked.
   */
  public selectTime(side: DateRangeSide, time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    const day = this.sideDay(side) ?? this.sideDay(side === 'start' ? 'end' : 'start');

    if (day === null) {
      this.halfPicks[side].holdTime(time);
      this.resolvePendingMixed();
    } else {
      this.halfPicks[side].clear();
      // the whole time of day comes from `time`, so the day carrier only has to supply a date -
      // which a zone proxy always reads correctly
      this.commitSideDate(side, reinterpretInZone(withTimeOfDay(day, time), this.effectiveTimeZone()));
    }

    this.touched.set(true);
  }

  /** The committed text of one side, or its half-pick rendered against placeholders. */
  public override displayValue(side: DateRangeSide) {
    const committed = super.displayValue(side);

    // a typing mask owns the field text and draws its own guides - a second set of placeholders
    // would not survive its reconciliation anyway
    if (committed !== '' || this.maskPattern() !== null) {
      return committed;
    }

    return (
      renderPartialDateTime({
        day: this.halfPicks[side].day(),
        time: this.halfPicks[side].time(),
        format: this.effectiveDisplayFormat(),
        locale: this.effectiveLocale(),
      }) ?? ''
    );
  }

  /** An actual edit to a side's field invalidates whatever half was held for it. */
  public override commitSide(side: DateRangeSide, raw: string) {
    if (raw !== this.displayValue(side)) {
      this.halfPicks[side].clear();
    }

    super.commitSide(side, raw);
  }

  /** Drops both held halves along with the range - they are one control state. */
  public override clearRange() {
    super.clearRange();
    this.halfPicks.start.clear();
    this.halfPicks.end.clear();
  }

  public parseSideCommit(raw: string) {
    return parseDateTimeText(raw, {
      format: this.effectiveDisplayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });
  }

  /** The day one side stands on: its committed one, else a day picked while its time is still missing. */
  private sideDay(side: DateRangeSide) {
    return this.pickerSideDate(side) ?? this.halfPicks[side].day();
  }

  private mergeDay(day: Date | null, side: DateRangeSide) {
    const held = this.halfPicks[side];

    // the calendar reports `end: null` for its whole first click, so dropping the held *time* here
    // would delete a time the reader picked before the days
    if (day === null) {
      held.clearDay();

      return null;
    }

    const committed = this.sideDate(side);
    const timeZone = this.effectiveTimeZone();

    if (committed !== null) {
      return timeZone === null ? withTimeOfDay(day, committed) : withZonedDay(committed, { day, timeZone });
    }

    const merged = held.holdDay(day);

    return merged === null ? null : reinterpretInZone(merged, timeZone);
  }

  /**
   * A half-pick resolves the bulk-edit mask like any other pick: replace, never merge into the
   * hidden raw range. `writeRange` already does this for a calendar pick.
   */
  private resolvePendingMixed() {
    if (this.mixed()) {
      this.value.set({ start: null, end: null });
      this.mixed.set(false);
    }
  }
}
