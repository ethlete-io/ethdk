import { Component, ViewEncapsulation, computed, input, model, numberAttribute, output } from '@angular/core';
import { Locale } from 'date-fns';
import { TimePickerComponent } from './time-picker.component';
import { injectTimePickerLabels } from './time-picker-labels';

export type TimeRangeSide = 'start' | 'end';

export type TimeRange = {
  start: Date | null;
  end: Date | null;
};

/**
 * Rejects individual times. The candidate is the picked time of day on the side's own day, and
 * `side` says which end is being filled - the hook for "the end must be after the start", which no
 * single-value bound can express.
 */
export type TimeRangeFilterFn = (date: Date, side: TimeRangeSide) => boolean;

/** What a pick reports: the time, and which end of the range it belongs to. */
export type TimeRangePick = {
  side: TimeRangeSide;
  time: Date;
};

/**
 * Two {@link TimePickerComponent}s as one range control: a start and an end set of columns under
 * their own headings, sharing one format, step, bound and filter. Both sides render at once - a
 * column shows one value, so a start and an end cannot share one - but a consumer mounts, labels,
 * localizes and filters them once.
 *
 * Bind `[rangeValue]` for display and read picks from `(timeSelect)`, which carries the side: a
 * control whose value is a pair of wire strings needs to know which half moved. `rangeValue` is a
 * model, so it also stands alone with `[(rangeValue)]`.
 */
@Component({
  selector: 'et-time-range-picker',
  templateUrl: './time-range-picker.component.html',
  styleUrl: './time-range-picker.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerComponent],
  host: {
    class: 'et-time-range-picker',
  },
})
export class TimeRangePickerComponent {
  private timePickerLabels = injectTimePickerLabels();

  /** The selected times, carried on `Date`s. A side stays `null` until one of its parts is picked. */
  public rangeValue = model<TimeRange>({ start: null, end: null });

  /** date-fns time format both sides' column layout derives from. Defaults to the `TIME_FORMAT` token. */
  public format = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);
  public minuteStep = input(5, { transform: numberAttribute });
  public secondStep = input(1, { transform: numberAttribute });

  /** Earliest / latest selectable time on both sides. Only the time of day is read. */
  public min = input<Date | null>(null);
  public max = input<Date | null>(null);
  public timeFilter = input<TimeRangeFilterFn | null>(null);

  /** Headings, and the accessible names of the two column groups. */
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);

  public hoursLabel = input<string | null>(null);
  public minutesLabel = input<string | null>(null);
  public secondsLabel = input<string | null>(null);
  public periodLabel = input<string | null>(null);

  /** A part was picked on one side. The side is what a range-valued consumer cannot infer. */
  public timeSelect = output<TimeRangePick>();

  /** The string in effect: this instance's `startLabel`, else the domain's label set. */
  public resolvedStartLabel = computed(() => this.startLabel() ?? this.timePickerLabels().startTime);

  /** The string in effect: this instance's `endLabel`, else the domain's label set. */
  public resolvedEndLabel = computed(() => this.endLabel() ?? this.timePickerLabels().endTime);

  /** `timeFilter` bound to one side - what each of the two time pickers receives. */
  protected startTimeFilter = computed(() => this.bindTimeFilter('start'));
  protected endTimeFilter = computed(() => this.bindTimeFilter('end'));

  protected selectSide(side: TimeRangeSide, time: Date | null) {
    if (time === null) {
      return;
    }

    this.rangeValue.set({ ...this.rangeValue(), [side]: time });
    this.timeSelect.emit({ side, time });
  }

  private bindTimeFilter(side: TimeRangeSide) {
    const filter = this.timeFilter();

    return filter === null ? null : (date: Date) => filter(date, side);
  }
}
