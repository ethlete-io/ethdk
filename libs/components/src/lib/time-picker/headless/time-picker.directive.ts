import { Directive, computed, input, model } from '@angular/core';
import { Locale, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { injectDateLocale, injectTimeFormat } from '../../forms/date-time/date-time-formats';
import { formatDateValue } from '../../forms/date-time/internals/date-value';
import { deriveTimeFormatSpec, generateSteppedValues, getTimeParts } from './internals/time-format';

export type TimePickerUnit = 'hour' | 'minute' | 'second' | 'period';

export type TimePickerOption = {
  unit: TimePickerUnit;
  /** Column-internal value: hours `0–23` (or `0–11`, 12-hour), minutes/seconds `0–59`, period `0` (AM) / `1` (PM). */
  value: number;
  label: string;
  selected: boolean;
  /** The column's roving-tabindex target (the selection, or the initial anchor while empty). */
  focused: boolean;
};

export type TimePickerColumn = {
  unit: TimePickerUnit;
  label: string;
  options: TimePickerOption[];
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
  private defaultFormat = injectTimeFormat();
  private defaultLocale = injectDateLocale();

  /** date-fns time format the column layout derives from. Defaults to the `TIME_FORMAT` token. */
  public format = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);
  public minuteStep = input(5);
  public secondStep = input(1);

  public hoursLabel = input('Hours');
  public minutesLabel = input('Minutes');
  public secondsLabel = input('Seconds');
  public periodLabel = input('AM/PM');

  /** The selected time of day, carried on a `Date`. Stays `null` until a part is picked. */
  public value = model<Date | null>(null);

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

  public columns = computed<TimePickerColumn[]>(() => {
    const spec = this.formatSpec();
    const value = this.value();
    const selected = value !== null ? getTimeParts(value, spec.hourCycle) : null;
    const anchor = getTimeParts(this.anchorTime(), spec.hourCycle);

    const buildOptions = (unit: Exclude<TimePickerUnit, 'period'>, values: number[]) => {
      const toLabel =
        unit === 'hour' && spec.hourCycle === 12
          ? (hour: number) => String(hour === 0 ? 12 : hour)
          : (part: number) => String(part).padStart(2, '0');

      return values.map<TimePickerOption>((optionValue) => ({
        unit,
        value: optionValue,
        label: toLabel(optionValue),
        selected: selected !== null && selected[unit] === optionValue,
        focused: (selected ?? anchor)[unit] === optionValue,
      }));
    };

    const hourValues = generateSteppedValues({ end: spec.hourCycle === 12 ? 12 : 24, step: 1 });

    const columns: TimePickerColumn[] = [
      { unit: 'hour', label: this.hoursLabel(), options: buildOptions('hour', hourValues) },
      {
        unit: 'minute',
        label: this.minutesLabel(),
        options: buildOptions(
          'minute',
          generateSteppedValues({ end: 60, step: this.minuteStep(), include: selected?.minute }),
        ),
      },
    ];

    if (spec.showSeconds) {
      columns.push({
        unit: 'second',
        label: this.secondsLabel(),
        options: buildOptions(
          'second',
          generateSteppedValues({ end: 60, step: this.secondStep(), include: selected?.second }),
        ),
      });
    }

    if (spec.hourCycle === 12) {
      const labels = this.periodLabels();

      columns.push({
        unit: 'period',
        label: this.periodLabel(),
        options: [0, 1].map<TimePickerOption>((period) => ({
          unit: 'period',
          value: period,
          label: labels[period] ?? '',
          selected: selected !== null && selected.period === period,
          focused: (selected ?? anchor).period === period,
        })),
      });
    }

    return columns;
  });

  /**
   * Commits one column's pick into the value. The first pick completes the
   * anchor time (what the columns visibly focus) with the picked part.
   */
  public selectPart(unit: TimePickerUnit, optionValue: number) {
    const spec = this.formatSpec();
    const base = this.anchorTime();

    switch (unit) {
      case 'hour': {
        const pmOffset = spec.hourCycle === 12 && getTimeParts(base, 12).period === 1 ? 12 : 0;

        this.value.set(setHours(base, optionValue + pmOffset));

        return;
      }
      case 'minute':
        this.value.set(setMinutes(base, optionValue));

        return;
      case 'second':
        this.value.set(setSeconds(base, optionValue));

        return;
      case 'period':
        this.value.set(setHours(base, (base.getHours() % 12) + (optionValue === 1 ? 12 : 0)));

        return;
    }
  }

  /** @internal Moves a column's selection by `delta`, wrapping (time units are cyclic). */
  public selectRelative(unit: TimePickerUnit, delta: number) {
    const options = this.optionsOf(unit);

    if (options.length === 0) {
      return;
    }

    const currentIndex = options.findIndex((option) => option.focused);
    const next = options[(Math.max(currentIndex, 0) + delta + options.length) % options.length];

    if (next) {
      this.selectPart(unit, next.value);
    }
  }

  /** @internal */
  public selectEdge(unit: TimePickerUnit, edge: 'start' | 'end') {
    const options = this.optionsOf(unit);
    const target = edge === 'start' ? options[0] : options[options.length - 1];

    if (target) {
      this.selectPart(unit, target.value);
    }
  }

  /** @internal Type-to-jump: selects the first option matching the buffered query. */
  public selectByQuery(unit: TimePickerUnit, query: string) {
    const match = this.optionsOf(unit).find(
      (option) => option.label.toLowerCase().startsWith(query) || String(option.value).startsWith(query),
    );

    if (match) {
      this.selectPart(unit, match.value);
    }
  }

  private optionsOf(unit: TimePickerUnit) {
    return this.columns().find((column) => column.unit === unit)?.options ?? [];
  }
}
