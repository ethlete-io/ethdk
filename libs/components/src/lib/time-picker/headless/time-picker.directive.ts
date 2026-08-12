import { Directive, computed, input, model, numberAttribute, output, signal } from '@angular/core';
import { Locale, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { injectDateLocale, injectTimeFormat } from '../../forms/date-time/date-time-formats';
import { formatDateValue } from '../../forms/date-time/internals/date-value';
import {
  PartialTimeCandidate,
  TimeAvailabilityOptions,
  TimeCandidate,
  findSelectableTime,
  hasSelectableTime,
  isTimeSelectable,
  setTimeOfDay,
} from './internals/time-availability';
import { TimeParts, deriveTimeFormatSpec, generateSteppedValues, getTimeParts } from './internals/time-format';
import { injectTimePickerLabels } from '../../time-picker/time-picker-labels';

export type TimePickerUnit = 'hour' | 'minute' | 'second' | 'period';

/** What the picker holds: one time, or a range whose two ends take turns on the same columns. */
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
 * hours can differ per weekday. `side` is the range end being filled - the hook for "the end must be
 * after the start", which no single-value bound can express - and is meaningless in `single` mode.
 */
export type TimePickerTimeFilterFn = (date: Date, side: TimeRangeSide) => boolean;

/**
 * Where an option sits in the band its column draws between the range's two ends. `'start'` and
 * `'end'` are the band's lower and upper option, not the range's start and end - a range whose end
 * precedes its start still bands between them.
 */
export type TimePickerBandPosition = 'start' | 'middle' | 'end' | null;

export type TimePickerOption = {
  unit: TimePickerUnit;
  /** Column-internal value: hours `0–23` (or `0–11`, 12-hour), minutes/seconds `0–59`, period `0` (AM) / `1` (PM). */
  value: number;
  label: string;
  selected: boolean;
  /** Out of bounds or filtered out - announced `aria-disabled`, skipped by the keyboard model. */
  disabled: boolean;
  /** The column's roving-tabindex target (the selection, or the initial anchor while empty). */
  focused: boolean;
  /** `range` mode: holds the range's start value, in a column that can place it. */
  rangeStart: boolean;
  /** `range` mode: holds the range's end value, in a column that can place it. */
  rangeEnd: boolean;
  /** `range` mode: presentational position in the band between the two ends, `null` outside it. */
  band: TimePickerBandPosition;
};

export type TimePickerColumn = {
  unit: TimePickerUnit;
  label: string;
  options: TimePickerOption[];
};

/** One end of a range, as the control that switches between the two needs it. */
export type TimePickerSide = {
  side: TimeRangeSide;
  label: string;
  /** The end rendered as a bare time, `null` while it is unset. */
  value: string | null;
  /** Whether the columns are currently editing this end. */
  active: boolean;
};

/** Coarsest first: a column can only place a range end when every unit above it holds the same value. */
const UNITS_COARSEST_FIRST: readonly TimePickerUnit[] = ['period', 'hour', 'minute', 'second'];

/** The next option a `±1` keyboard step lands on, wrapping and skipping disabled ones. */
const nextEnabledIndex = (options: readonly TimePickerOption[], walk: { from: number; step: number }) => {
  for (let offset = 1; offset <= options.length; offset++) {
    const index = (((walk.from + walk.step * offset) % options.length) + options.length) % options.length;

    if (!options[index]?.disabled) {
      return index;
    }
  }

  return null;
};

/**
 * Headless time picker state: one listbox column per time unit (derived from a
 * date-fns `format` - hours, minutes, optional seconds and AM/PM), selection
 * per column committing into a single `Date` value. Operates on `Date` objects
 * only - string parsing/formatting belongs to the input directives.
 *
 * In `range` mode the same columns hold a `rangeValue`, one end at a time:
 * `activeSide` says which, the columns show and a pick writes that end, and the
 * other end still reads out of them as `rangeStart`/`rangeEnd` and a `band`.
 */
@Directive({
  selector: '[etTimePicker]',
  exportAs: 'etTimePicker',
})
export class TimePickerDirective {
  private timePickerLabels = injectTimePickerLabels();

  private defaultFormat = injectTimeFormat();
  private defaultLocale = injectDateLocale();

  /** Whether the columns hold one time (`value`) or a range (`rangeValue`). */
  public mode = input<TimePickerMode>('single');

  /** date-fns time format the column layout derives from. Defaults to the `TIME_FORMAT` token. */
  public format = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);
  public minuteStep = input(5, { transform: numberAttribute });
  public secondStep = input(1, { transform: numberAttribute });

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

  public hoursLabel = input<string | null>(null);
  public minutesLabel = input<string | null>(null);
  public secondsLabel = input<string | null>(null);
  public periodLabel = input<string | null>(null);

  /** `range` mode: the two ends' names, on the control that switches between them. */
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);

  /** The selected time of day, carried on a `Date`. Stays `null` until a part is picked. `single` mode. */
  public value = model<Date | null>(null);

  /** `range` mode: the two selected times. An end stays `null` until one of its parts is picked. */
  public rangeValue = model<TimeRange>({ start: null, end: null });

  /** `range` mode: the end the columns show, and the one a pick writes. */
  public activeSide = model<TimeRangeSide>('start');

  /** `range` mode: a part was picked. The side is what a range-valued consumer cannot infer. */
  public timeSelect = output<TimeRangePick>();

  /** The string in effect: this instance's `hoursLabel`, else the domain's label set. */
  public resolvedHoursLabel = computed(() => this.hoursLabel() ?? this.timePickerLabels().hours);

  /** The string in effect: this instance's `minutesLabel`, else the domain's label set. */
  public resolvedMinutesLabel = computed(() => this.minutesLabel() ?? this.timePickerLabels().minutes);

  /** The string in effect: this instance's `secondsLabel`, else the domain's label set. */
  public resolvedSecondsLabel = computed(() => this.secondsLabel() ?? this.timePickerLabels().seconds);

  /** The string in effect: this instance's `periodLabel`, else the domain's label set. */
  public resolvedPeriodLabel = computed(() => this.periodLabel() ?? this.timePickerLabels().period);

  /** The string in effect: this instance's `startLabel`, else the domain's label set. */
  public resolvedStartLabel = computed(() => this.startLabel() ?? this.timePickerLabels().startTime);

  /** The string in effect: this instance's `endLabel`, else the domain's label set. */
  public resolvedEndLabel = computed(() => this.endLabel() ?? this.timePickerLabels().endTime);

  // the initial focus/scroll anchor while no value exists
  private now = new Date();

  private autoAdvanceSpent = signal(false);

  public effectiveFormat = computed(() => this.format() ?? this.defaultFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public formatSpec = computed(() =>
    deriveTimeFormatSpec({ format: this.effectiveFormat(), locale: this.effectiveLocale() }),
  );

  /** The value the columns show and a pick writes: the whole value, or the range's active end. */
  public activeValue = computed(() => (this.mode() === 'range' ? this.rangeValue()[this.activeSide()] : this.value()));

  /**
   * A bare time format matching the columns in play, rather than `format` itself - a host that
   * derives its columns from a *combined* date & time format (the date-time range input passes `Pp`)
   * still needs the two ends to read as times.
   */
  private sideFormat = computed(() => {
    const spec = this.formatSpec();

    return spec.hourCycle === 12 ? `h:mm${spec.showSeconds ? ':ss' : ''} a` : `HH:mm${spec.showSeconds ? ':ss' : ''}`;
  });

  /**
   * The two ends as a side switch needs them: which end, its name, its value as a bare time, and
   * whether the columns are currently editing it.
   */
  public sides = computed<readonly TimePickerSide[]>(() => {
    const range = this.rangeValue();
    const active = this.activeSide();
    const options = { format: this.sideFormat(), locale: this.effectiveLocale() };
    const rendered = (time: Date | null) => (time === null ? null : formatDateValue(time, options));

    return [
      { side: 'start', label: this.resolvedStartLabel(), value: rendered(range.start), active: active === 'start' },
      { side: 'end', label: this.resolvedEndLabel(), value: rendered(range.end), active: active === 'end' },
    ];
  });

  /**
   * The value, or "now" snapped to the steps - the time the columns anchor
   * their roving focus and initial scroll position to, and the base a first
   * part pick completes into a full value. Units without a column are zeroed
   * so a completed anchor never carries an invisible seconds part.
   */
  public anchorTime = computed<Date>(() => {
    const value = this.activeValue();

    if (value !== null) {
      return value;
    }

    const snappedMinute = this.now.getMinutes() - (this.now.getMinutes() % this.minuteStep());
    const snappedSecond = this.formatSpec().showSeconds
      ? this.now.getSeconds() - (this.now.getSeconds() % this.secondStep())
      : 0;

    return setMilliseconds(
      setSeconds(setMinutes(setHours(startOfDay(this.now), this.now.getHours()), snappedMinute), snappedSecond),
      0,
    );
  });

  private periodLabels = computed(() => {
    const locale = this.effectiveLocale();
    const anchor = startOfDay(this.now);

    return [
      formatDateValue(setHours(anchor, 0), { format: 'a', locale }) ?? 'AM',
      formatDateValue(setHours(anchor, 12), { format: 'a', locale }) ?? 'PM',
    ];
  });

  /** The active value's column values, or `null` while empty - hours in the format's cycle. */
  private selectedParts = computed(() => {
    const value = this.activeValue();

    return value !== null ? getTimeParts(value, this.formatSpec().hourCycle) : null;
  });

  /** Both range ends' column values, `null` outside `range` mode. */
  private rangeParts = computed(() => {
    if (this.mode() !== 'range') {
      return null;
    }

    const range = this.rangeValue();
    const cycle = this.formatSpec().hourCycle;

    return {
      start: range.start === null ? null : getTimeParts(range.start, cycle),
      end: range.end === null ? null : getTimeParts(range.end, cycle),
    };
  });

  private hourValues = computed(() =>
    generateSteppedValues({ end: this.formatSpec().hourCycle === 12 ? 12 : 24, step: 1 }),
  );

  private minuteValues = computed(() =>
    generateSteppedValues({ end: 60, step: this.minuteStep(), include: this.selectedParts()?.minute }),
  );

  private secondValues = computed(() =>
    generateSteppedValues({ end: 60, step: this.secondStep(), include: this.selectedParts()?.second }),
  );

  /** Whether any bound or filter is in play - the unconstrained picker skips availability work entirely. */
  private constrained = computed(() => this.min() !== null || this.max() !== null || this.timeFilter() !== null);

  /** `timeFilter` with the end it is filling already applied - what the availability layer takes. */
  private boundTimeFilter = computed(() => {
    const filter = this.timeFilter();

    if (filter === null) {
      return null;
    }

    const side = this.activeSide();

    return (date: Date) => filter(date, side);
  });

  private availability = computed<TimeAvailabilityOptions>(() => {
    const anchor = this.anchorTime();

    return {
      min: this.min(),
      max: this.max(),
      filter: this.boundTimeFilter(),
      day: startOfDay(anchor),
      minuteValues: this.minuteValues(),
      // without a seconds column the second never moves - the committed one is the only candidate
      secondValues: this.formatSpec().showSeconds ? this.secondValues() : [anchor.getSeconds()],
    };
  });

  public columns = computed<TimePickerColumn[]>(() => {
    const spec = this.formatSpec();
    const selected = this.selectedParts();
    const anchor = getTimeParts(this.anchorTime(), spec.hourCycle);
    const anchor24 = getTimeParts(this.anchorTime(), 24);
    const constrained = this.constrained();
    const availability = this.availability();

    const isDisabled = (fixed: PartialTimeCandidate) => constrained && !hasSelectableTime(fixed, availability);
    const rangeFlagsFor = this.rangeFlagsFactory({ anchor, hourCycle: spec.hourCycle });

    const buildOptions = (
      unit: Exclude<TimePickerUnit, 'period'>,
      column: { values: number[]; fixedOf: (value: number) => PartialTimeCandidate },
    ) => {
      const toLabel =
        unit === 'hour' && spec.hourCycle === 12
          ? (hour: number) => String(hour === 0 ? 12 : hour)
          : (part: number) => String(part).padStart(2, '0');
      const rangeFlags = rangeFlagsFor(unit);

      return column.values.map<TimePickerOption>((optionValue) => ({
        unit,
        value: optionValue,
        label: toLabel(optionValue),
        selected: selected !== null && selected[unit] === optionValue,
        disabled: isDisabled(column.fixedOf(optionValue)),
        focused: (selected ?? anchor)[unit] === optionValue,
        ...rangeFlags(optionValue),
      }));
    };

    const columns: TimePickerColumn[] = [
      {
        unit: 'hour',
        label: this.resolvedHoursLabel(),
        options: buildOptions('hour', {
          values: this.hourValues(),
          fixedOf: (hour) => ({ hour: this.toHour24(hour, anchor24.period) }),
        }),
      },
      {
        unit: 'minute',
        label: this.resolvedMinutesLabel(),
        options: buildOptions('minute', {
          values: this.minuteValues(),
          fixedOf: (minute) => ({ hour: anchor24.hour, minute }),
        }),
      },
    ];

    if (spec.showSeconds) {
      columns.push({
        unit: 'second',
        label: this.resolvedSecondsLabel(),
        options: buildOptions('second', {
          values: this.secondValues(),
          fixedOf: (second) => ({ hour: anchor24.hour, minute: anchor24.minute, second }),
        }),
      });
    }

    if (spec.hourCycle === 12) {
      const labels = this.periodLabels();
      const rangeFlags = rangeFlagsFor('period');

      columns.push({
        unit: 'period',
        label: this.resolvedPeriodLabel(),
        options: [0, 1].map<TimePickerOption>((period) => ({
          unit: 'period',
          value: period,
          label: labels[period] ?? '',
          selected: selected !== null && selected.period === period,
          // a half-day is out only when none of its twelve hours has a selectable time
          disabled:
            constrained &&
            !this.hourValues().some((hour) => hasSelectableTime({ hour: hour + period * 12 }, availability)),
          focused: (selected ?? anchor).period === period,
          ...rangeFlags(period),
        })),
      });
    }

    return columns;
  });

  /**
   * Commits one column's pick into the value. The first pick completes the
   * anchor time (what the columns visibly focus) with the picked part. Bounds
   * and filters keep the result selectable: the picked part stays put and the
   * finer units move to the first value that works.
   */
  public selectPart(unit: TimePickerUnit, optionValue: number) {
    if (this.optionsOf(unit).find((option) => option.value === optionValue)?.disabled) {
      return;
    }

    const target = this.candidateFor(unit, optionValue);
    const resolved = this.constrained() ? this.resolveSelectable(unit, target) : target;

    if (resolved === null) {
      return;
    }

    const next = setTimeOfDay(this.anchorTime(), resolved);

    if (this.mode() !== 'range') {
      this.value.set(next);

      return;
    }

    const side = this.activeSide();

    this.rangeValue.set({ ...this.rangeValue(), [side]: next });
    this.timeSelect.emit({ side, time: next });
  }

  /**
   * @internal What *activating* an option does (click, Enter, Space): the pick, plus a range's
   * one-time hop to the other end - the first committed start opens the end, the way a calendar's
   * first pick opens its range. The keyboard model deliberately routes through {@link selectPart}
   * instead: arrows commit as they move, so hopping there would strand the reader on the other end
   * halfway through browsing this one.
   */
  public activateOption(unit: TimePickerUnit, optionValue: number) {
    const hops = this.mode() === 'range' && this.activeSide() === 'start' && !this.autoAdvanceSpent();
    const startBefore = this.rangeValue().start;

    this.selectPart(unit, optionValue);

    if (hops && this.rangeValue().start !== startBefore) {
      this.autoAdvanceSpent.set(true);
      this.activeSide.set('end');
    }
  }

  /** Switches the end the columns edit, spending the one-time auto-advance - an explicit choice wins. */
  public setActiveSide(side: TimeRangeSide) {
    this.autoAdvanceSpent.set(true);
    this.activeSide.set(side);
  }

  /** @internal Moves a column's selection by `delta`, wrapping and skipping disabled options. */
  public selectRelative(unit: TimePickerUnit, delta: number) {
    const options = this.optionsOf(unit);

    if (options.length === 0) {
      return;
    }

    const step = delta < 0 ? -1 : 1;
    const from = Math.max(
      options.findIndex((option) => option.focused),
      0,
    );

    // walk `delta` enabled options; a fully disabled column simply never moves
    let index = from;

    for (let taken = 0; taken < Math.abs(delta); taken++) {
      const next = nextEnabledIndex(options, { from: index, step });

      if (next === null) {
        return;
      }

      index = next;
    }

    const target = options[index];

    if (target) {
      this.selectPart(unit, target.value);
    }
  }

  /** @internal */
  public selectEdge(unit: TimePickerUnit, edge: 'start' | 'end') {
    const options = this.optionsOf(unit);
    const enabled = options.filter((option) => !option.disabled);
    const target = edge === 'start' ? enabled[0] : enabled[enabled.length - 1];

    if (target) {
      this.selectPart(unit, target.value);
    }
  }

  /** @internal Type-to-jump: selects the first selectable option matching the buffered query. */
  public selectByQuery(unit: TimePickerUnit, query: string) {
    const match = this.optionsOf(unit).find(
      (option) =>
        !option.disabled && (option.label.toLowerCase().startsWith(query) || String(option.value).startsWith(query)),
    );

    if (match) {
      this.selectPart(unit, match.value);
    }
  }

  /**
   * Builds the per-column reader for how an option relates to the *range* - which end it holds, and
   * where in the band between the two ends it sits.
   *
   * A column can only place an end when every **coarser** unit of that end matches what the columns
   * are showing: the minutes column may say where 09:15's `15` is while the hours sit on 9, but not
   * while they sit on 17, where minute 15 belongs to a different hour and would read as an endpoint
   * it is not. That one rule is what keeps the hours banded across 09:00–17:30 while the minutes stay
   * plain, and what stops a 12-hour hours column from banding 9 AM to 5 PM, whose column order is not
   * chronological across the half-day boundary.
   *
   * Within a column, option *values* ascend with time in every unit - hours `0–23`, `0–11` inside a
   * half-day, stepped minutes and seconds, AM before PM - so the band is a plain numeric interval.
   */
  private rangeFlagsFactory(context: { anchor: TimeParts; hourCycle: 12 | 24 }) {
    const rangeParts = this.rangeParts();

    return (unit: TimePickerUnit) => {
      const coarser = UNITS_COARSEST_FIRST.slice(0, UNITS_COARSEST_FIRST.indexOf(unit)).filter(
        (coarserUnit) => coarserUnit !== 'period' || context.hourCycle === 12,
      );
      const placeable = (parts: TimeParts | null) =>
        parts !== null && coarser.every((coarserUnit) => parts[coarserUnit] === context.anchor[coarserUnit])
          ? parts
          : null;

      const start = placeable(rangeParts?.start ?? null);
      const end = placeable(rangeParts?.end ?? null);
      const bounds =
        start === null || end === null || start[unit] === end[unit]
          ? null
          : { from: Math.min(start[unit], end[unit]), to: Math.max(start[unit], end[unit]) };

      const bandOf = (optionValue: number): TimePickerBandPosition => {
        if (bounds === null || optionValue < bounds.from || optionValue > bounds.to) {
          return null;
        }

        if (optionValue === bounds.from) {
          return 'start';
        }

        return optionValue === bounds.to ? 'end' : 'middle';
      };

      return (optionValue: number) => ({
        rangeStart: start !== null && start[unit] === optionValue,
        rangeEnd: end !== null && end[unit] === optionValue,
        band: bandOf(optionValue),
      });
    };
  }

  /** The 24-hour value a column option stands for, given the half-day in effect. */
  private toHour24(hour: number, period: 0 | 1) {
    return this.formatSpec().hourCycle === 12 ? (hour % 12) + period * 12 : hour;
  }

  /** The twelve hours of `from`'s half-day, closest to `from` first. */
  private halfDayHours(from: number) {
    const base = from >= 12 ? 12 : 0;

    return Array.from({ length: 12 }, (_, index) => base + index).sort(
      (first, second) => Math.abs(first - from) - Math.abs(second - from),
    );
  }

  /** The time a pick aims at: the picked part, with every other part kept from the anchor. */
  private candidateFor(unit: TimePickerUnit, optionValue: number): TimeCandidate {
    const parts = getTimeParts(this.anchorTime(), 24);

    switch (unit) {
      case 'hour':
        return { hour: this.toHour24(optionValue, parts.period), minute: parts.minute, second: parts.second };
      case 'minute':
        return { hour: parts.hour, minute: optionValue, second: parts.second };
      case 'second':
        return { hour: parts.hour, minute: parts.minute, second: optionValue };
      case 'period':
        return {
          hour: (parts.hour % 12) + (optionValue === 1 ? 12 : 0),
          minute: parts.minute,
          second: parts.second,
        };
    }
  }

  /** The candidate itself when it is selectable, else the same pick with the unpicked units moved. */
  private resolveSelectable(unit: TimePickerUnit, candidate: TimeCandidate) {
    const availability = this.availability();

    if (isTimeSelectable(candidate, availability)) {
      return candidate;
    }

    // an AM/PM pick chooses a half-day, not an hour: keeping the clock position (10 AM → 10 PM)
    // is only the preference, so the hour may move inside the picked half - closest first
    if (unit === 'period') {
      for (const hour of this.halfDayHours(candidate.hour)) {
        const found = findSelectableTime({ hour }, availability);

        if (found !== null) {
          return found;
        }
      }

      return null;
    }

    // everything the pick did not touch may move; the picked part never does
    const fixed: PartialTimeCandidate =
      unit === 'second'
        ? candidate
        : unit === 'minute'
          ? { hour: candidate.hour, minute: candidate.minute }
          : { hour: candidate.hour };

    return findSelectableTime(fixed, availability);
  }

  private optionsOf(unit: TimePickerUnit) {
    return this.columns().find((column) => column.unit === unit)?.options ?? [];
  }
}
