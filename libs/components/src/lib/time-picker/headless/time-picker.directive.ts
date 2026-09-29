import { Directive, computed, input, model, output, signal } from '@angular/core';
import { injectHostElement } from '@ethlete/core';
import { Locale, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { injectDateLocale, injectTimeFormat } from '../../forms/date-time/date-time-formats';
import { formatDateValue } from '../../forms/date-time/internals/date-value';
import { setTimeOfDay } from './internals/time-availability';
import { deriveTimeFormatSpec } from './internals/time-format';
import { TimeRingStops, createTimeRingStops, isStopOpen, timeRingOpenCheck } from './internals/time-ring';
import { injectTimePickerLabels } from '../../time-picker/time-picker-labels';
import { positiveIntegerAttribute } from '../../internals/number-attributes';

/** What the picker holds: one time, or a range whose two ends share one ring. */
export type TimePickerMode = 'single' | 'range';

export type TimeRangeSide = 'start' | 'end';

export type TimeRange = {
  start: Date | null;
  end: Date | null;
};

/** What a range pick reports: the time, and which end of the range it filled. */
export type TimeRangePick = {
  side: TimeRangeSide;
  time: Date;
};

/**
 * Rejects individual times. The candidate is the picked time of day on the current day, so opening
 * hours can differ per weekday. `side` is the range end being filled, and is meaningless in
 * `single` mode.
 */
export type TimePickerTimeFilterFn = (date: Date, side: TimeRangeSide) => boolean;

/**
 * Headless time picker state behind a 24h ring: one time or a range, committed as `Date` values. Place an
 * `[etTimePickerRing]` inside it. Operates on `Date` objects only - string parsing and formatting belong to the
 * input directives.
 */
@Directive({
  selector: '[etTimePicker]',
  exportAs: 'etTimePicker',
  host: {
    '(focusin)': 'refreshNow($event)',
  },
})
export class TimePickerDirective {
  private timePickerLabels = injectTimePickerLabels();

  private defaultFormat = injectTimeFormat();
  private defaultLocale = injectDateLocale();

  private hostElement = injectHostElement();

  /** Whether the ring holds one time (`value`) or a range (`rangeValue`). */
  public mode = input<TimePickerMode>('single');

  /** date-fns time format of the ring's labels and readout. Defaults to the `TIME_FORMAT` token. */
  public format = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);
  public minuteStep = input(5, { transform: positiveIntegerAttribute });
  public secondStep = input(1, { transform: positiveIntegerAttribute });

  /** Earliest selectable time. Only the time of day is read, so the bound applies to every day. */
  public min = input<Date | null>(null);
  /** Latest selectable time. Only the time of day is read, so the bound applies to every day. */
  public max = input<Date | null>(null);
  /**
   * Return `false` to make a time unselectable. Receives the full candidate timestamp
   * (the picked time of day on the current day), so opening hours can differ per weekday, and in
   * `range` mode the end being filled. See {@link TimePickerTimeFilterFn}.
   */
  public timeFilter = input<TimePickerTimeFilterFn | null>(null);

  /** `range` mode: the names of the two ends, on their ring handles. */
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);

  /** The selected time of day, carried on a `Date`. `single` mode. */
  public value = model<Date | null>(null);

  /** `range` mode: the two selected times. */
  public rangeValue = model<TimeRange>({ start: null, end: null });

  /** `range` mode: the end the ring centre shows and whose blocked spans the track draws. */
  public activeSide = model<TimeRangeSide>('start');

  /**
   * The day the time falls on, from a calendar next to the picker. Set, the ring centre shows it under the time.
   * `single` mode.
   */
  public day = input<Date | null>(null);

  /**
   * `range` mode: the day of each end, from a calendar next to the picker. Set, the ring centre shows the time and
   * the day of the active end instead of the duration.
   */
  public rangeDays = input<TimeRange | null>(null);

  /** `range` mode: an end became a whole time. */
  public timeSelect = output<TimeRangePick>();

  /**
   * `range` mode: a tap on the ring filled the start of an empty range and handed the active side on to the end.
   * Emits the side that became active, so a host can move focus to its field.
   */
  public rangeHandOff = output<TimeRangeSide>();

  public resolvedTimeLabel = computed(() => this.timePickerLabels().time);

  public resolvedStartLabel = computed(() => this.startLabel() ?? this.timePickerLabels().startTime);

  public resolvedEndLabel = computed(() => this.endLabel() ?? this.timePickerLabels().endTime);

  private now = signal(new Date());

  public effectiveFormat = computed(() => this.format() ?? this.defaultFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public formatSpec = computed(() =>
    deriveTimeFormatSpec({ format: this.effectiveFormat(), locale: this.effectiveLocale() }),
  );

  /** The whole value, or the range's active end. */
  public activeValue = computed(() => (this.mode() === 'range' ? this.rangeValue()[this.activeSide()] : this.value()));

  private sideFormat = computed(() => {
    const spec = this.formatSpec();

    return spec.hourCycle === 12 ? `h:mm${spec.showSeconds ? ':ss' : ''} a` : `HH:mm${spec.showSeconds ? ':ss' : ''}`;
  });

  private startRingDay = computed(() => startOfDay(this.ringValue('start') ?? this.now()).getTime());
  private endRingDay = computed(() => startOfDay(this.ringValue('end') ?? this.now()).getTime());

  /** @internal The ring stops of each end, open where `min`, `max` and `timeFilter` allow a time. */
  public ringStops = computed<Record<TimeRangeSide, TimeRingStops>>(() => ({
    start: this.ringStopsFor('start', this.startRingDay()),
    end: this.ringStopsFor('end', this.endRingDay()),
  }));

  /** The active value, or "now" snapped to the steps: where the keyboard starts on an empty ring. */
  public anchorTime = computed<Date>(() => {
    const value = this.activeValue();

    if (value !== null) {
      return value;
    }

    const now = this.now();
    const minute = now.getMinutes() - (now.getMinutes() % this.minuteStep());
    const second = this.formatSpec().showSeconds ? now.getSeconds() - (now.getSeconds() % this.secondStep()) : 0;

    return setMilliseconds(setSeconds(setMinutes(now, minute), second), 0);
  });

  /** @internal The value of one end as a minute of the day. `single` mode reads `start`. */
  public ringMinute(side: TimeRangeSide) {
    const value = this.ringValue(side);

    return value === null ? null : value.getHours() * 60 + value.getMinutes();
  }

  /** @internal */
  public ringValueText(side: TimeRangeSide) {
    const value = this.ringValue(side);

    return value === null
      ? null
      : formatDateValue(value, { format: this.sideFormat(), locale: this.effectiveLocale() });
  }

  /**
   * @internal Writes a whole time from the ring: the hour and minute of `minute`, second 0, on the day of the end.
   * A blocked minute writes nothing. In `range` mode the end becomes the active side; the first start on an empty
   * range hands the active side on to the end. Returns whether it handed on.
   */
  public commitRingMinute(side: TimeRangeSide, minute: number) {
    if (!isStopOpen(this.ringStops()[side], minute)) {
      return false;
    }

    const current = this.ringValue(side);
    const next = setMilliseconds(
      setTimeOfDay(current ?? startOfDay(this.now()), {
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        second: 0,
      }),
      0,
    );

    if (current !== null && current.getTime() === next.getTime()) {
      return false;
    }

    if (this.mode() !== 'range') {
      this.value.set(next);

      return false;
    }

    const range = this.rangeValue();
    const handsOn = side === 'start' && range.start === null && range.end === null;

    this.rangeValue.set({ ...range, [side]: next });
    this.timeSelect.emit({ side, time: next });
    this.activeSide.set(handsOn ? 'end' : side);

    return handsOn;
  }

  protected refreshNow(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && this.hostElement.contains(event.relatedTarget)) return;

    this.now.set(new Date());
  }

  private ringValue(side: TimeRangeSide) {
    return this.mode() === 'range' ? this.rangeValue()[side] : this.value();
  }

  private ringStopsFor(side: TimeRangeSide, day: number) {
    const filter = this.timeFilter();

    return createTimeRingStops(
      this.minuteStep(),
      timeRingOpenCheck({
        min: this.min(),
        max: this.max(),
        filter: filter === null ? null : (date) => filter(date, side),
        day: new Date(day),
      }),
    );
  }
}
