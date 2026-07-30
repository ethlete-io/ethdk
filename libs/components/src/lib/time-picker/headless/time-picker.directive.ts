import { Directive, computed, input, model, numberAttribute } from '@angular/core';
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
import { deriveTimeFormatSpec, generateSteppedValues, getTimeParts } from './internals/time-format';
import { injectTimePickerLabels } from '../../time-picker/time-picker-labels';

export type TimePickerUnit = 'hour' | 'minute' | 'second' | 'period';

export type TimePickerOption = {
  unit: TimePickerUnit;
  /** Column-internal value: hours `0–23` (or `0–11`, 12-hour), minutes/seconds `0–59`, period `0` (AM) / `1` (PM). */
  value: number;
  label: string;
  selected: boolean;
  /** Out of bounds or filtered out — announced `aria-disabled`, skipped by the keyboard model. */
  disabled: boolean;
  /** The column's roving-tabindex target (the selection, or the initial anchor while empty). */
  focused: boolean;
};

export type TimePickerColumn = {
  unit: TimePickerUnit;
  label: string;
  options: TimePickerOption[];
};

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
 * date-fns `format` — hours, minutes, optional seconds and AM/PM), selection
 * per column committing into a single `Date` value. Operates on `Date` objects
 * only — string parsing/formatting belongs to the input directives.
 */
@Directive({
  selector: '[etTimePicker]',
  exportAs: 'etTimePicker',
})
export class TimePickerDirective {
  private timePickerLabels = injectTimePickerLabels();

  private defaultFormat = injectTimeFormat();
  private defaultLocale = injectDateLocale();

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
   * (the picked time of day on the current day), so opening hours can differ per weekday.
   */
  public timeFilter = input<((date: Date) => boolean) | null>(null);

  public hoursLabel = input<string | null>(null);
  public minutesLabel = input<string | null>(null);
  public secondsLabel = input<string | null>(null);
  public periodLabel = input<string | null>(null);

  /** The selected time of day, carried on a `Date`. Stays `null` until a part is picked. */
  public value = model<Date | null>(null);

  /** The string in effect: this instance's `hoursLabel`, else the domain's label set. */
  public resolvedHoursLabel = computed(() => this.hoursLabel() ?? this.timePickerLabels().hours);

  /** The string in effect: this instance's `minutesLabel`, else the domain's label set. */
  public resolvedMinutesLabel = computed(() => this.minutesLabel() ?? this.timePickerLabels().minutes);

  /** The string in effect: this instance's `secondsLabel`, else the domain's label set. */
  public resolvedSecondsLabel = computed(() => this.secondsLabel() ?? this.timePickerLabels().seconds);

  /** The string in effect: this instance's `periodLabel`, else the domain's label set. */
  public resolvedPeriodLabel = computed(() => this.periodLabel() ?? this.timePickerLabels().period);

  // the initial focus/scroll anchor while no value exists
  private now = new Date();

  public effectiveFormat = computed(() => this.format() ?? this.defaultFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public formatSpec = computed(() =>
    deriveTimeFormatSpec({ format: this.effectiveFormat(), locale: this.effectiveLocale() }),
  );

  /**
   * The value, or "now" snapped to the steps — the time the columns anchor
   * their roving focus and initial scroll position to, and the base a first
   * part pick completes into a full value. Units without a column are zeroed
   * so a completed anchor never carries an invisible seconds part.
   */
  public anchorTime = computed<Date>(() => {
    const value = this.value();

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

  /** The value's column values, or `null` while empty — hours in the format's cycle. */
  private selectedParts = computed(() => {
    const value = this.value();

    return value !== null ? getTimeParts(value, this.formatSpec().hourCycle) : null;
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

  /** Whether any bound or filter is in play — the unconstrained picker skips availability work entirely. */
  private constrained = computed(() => this.min() !== null || this.max() !== null || this.timeFilter() !== null);

  private availability = computed<TimeAvailabilityOptions>(() => {
    const anchor = this.anchorTime();

    return {
      min: this.min(),
      max: this.max(),
      filter: this.timeFilter(),
      day: startOfDay(anchor),
      minuteValues: this.minuteValues(),
      // without a seconds column the second never moves — the committed one is the only candidate
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

    const buildOptions = (
      unit: Exclude<TimePickerUnit, 'period'>,
      column: { values: number[]; fixedOf: (value: number) => PartialTimeCandidate },
    ) => {
      const toLabel =
        unit === 'hour' && spec.hourCycle === 12
          ? (hour: number) => String(hour === 0 ? 12 : hour)
          : (part: number) => String(part).padStart(2, '0');

      return column.values.map<TimePickerOption>((optionValue) => ({
        unit,
        value: optionValue,
        label: toLabel(optionValue),
        selected: selected !== null && selected[unit] === optionValue,
        disabled: isDisabled(column.fixedOf(optionValue)),
        focused: (selected ?? anchor)[unit] === optionValue,
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

    this.value.set(setTimeOfDay(this.anchorTime(), resolved));
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
    // is only the preference, so the hour may move inside the picked half — closest first
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
