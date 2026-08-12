import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { TIME_PICKER_IMPORTS } from '../time-picker.imports';
import { TimeRange, TimeRangeFilterFn } from '../time-range-picker.component';
import { parseTimeOfDay, resolveTimeFilterPreset } from './time-filter-presets';

/** `'endAfterStart'` is the one only a range can express; the others come from the shared presets. */
export type TimeRangeFilterPreset = 'none' | 'noLunchBreak' | 'weekdayHours' | 'endAfterStart';

@Component({
  selector: 'et-sb-time-range-picker',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-2xl flex-col items-start gap-4 p-8 font-sans">
      <et-time-range-picker
        [(rangeValue)]="rangeValue"
        [format]="format()"
        [locale]="localeObject()"
        [minuteStep]="minuteStep()"
        [secondStep]="secondStep()"
        [min]="minTimeDate()"
        [max]="maxTimeDate()"
        [timeFilter]="filterFn()"
        [startLabel]="startLabel()"
        [endLabel]="endLabel()"
      />

      <p class="text-sm opacity-60">
        Start: {{ rangeValue().start?.toTimeString() ?? 'null' }} · End:
        {{ rangeValue().end?.toTimeString() ?? 'null' }}
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...TIME_PICKER_IMPORTS, ProvideColorDirective],
})
export class TimeRangePickerStorybookComponent {
  public format = input('HH:mm');
  public minuteStep = input(5);
  public secondStep = input(1);
  public locale = input<'default' | 'de'>('default');
  /** `HH:mm` bounds - the story turns them into the `Date`s the picker takes. */
  public minTime = input<string | null>(null);
  public maxTime = input<string | null>(null);
  public filter = input<TimeRangeFilterPreset>('none');
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);
  /** `HH:mm` starting values. */
  public start = input<string | null>(null);
  public end = input<string | null>(null);
  public color = input('brand');

  public rangeValue = linkedSignal<TimeRange>(() => ({
    start: parseTimeOfDay(this.start()),
    end: parseTimeOfDay(this.end()),
  }));

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  protected minTimeDate = computed(() => parseTimeOfDay(this.minTime()));
  protected maxTimeDate = computed(() => parseTimeOfDay(this.maxTime()));

  protected filterFn = computed<TimeRangeFilterFn | null>(() => {
    const preset = this.filter();

    if (preset === 'endAfterStart') {
      return (candidate, side) => {
        if (side === 'start') {
          return true;
        }

        // read inside the closure, so the end re-filters when the start moves
        const start = this.rangeValue().start;

        return start === null || candidate > start;
      };
    }

    const shared = resolveTimeFilterPreset(preset);

    return shared === null ? null : (candidate) => shared(candidate);
  });
}
