import { Component, ViewEncapsulation, computed, input, linkedSignal, signal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { isValid, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimePickerMode, TimePickerTimeFilterFn, TimeRange, TimeRangeSide } from '../headless';
import { TIME_PICKER_IMPORTS } from '../time-picker.imports';
import { TimeFilterPreset, parseTimeOfDay, resolveTimeFilterPreset } from './time-filter-presets';

export type TimePickerFilterPreset = TimeFilterPreset | 'endAfterStart';

const parseDay = (value: string | null) => {
  const day = value === null ? null : parseISO(value);

  return day !== null && isValid(day) ? day : null;
};

@Component({
  selector: 'et-sb-time-picker',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col items-start gap-4 p-8 font-sans">
      <et-time-picker
        [(value)]="value"
        [(rangeValue)]="rangeValue"
        [mode]="mode()"
        [format]="format()"
        [locale]="localeObject()"
        [minuteStep]="minuteStep()"
        [min]="minTimeDate()"
        [max]="maxTimeDate()"
        [timeFilter]="filterFn()"
        [startLabel]="startLabel()"
        [endLabel]="endLabel()"
        [day]="dayDate()"
        [rangeDays]="rangeDaysValue()"
        [disabled]="disabled()"
        (rangeHandOff)="handOff.set($event)"
      />

      @if (mode() === 'range') {
        <p class="text-small opacity-60">
          Start: {{ rangeValue().start?.toTimeString() ?? 'null' }} · End:
          {{ rangeValue().end?.toTimeString() ?? 'null' }}
        </p>
        <p class="text-small opacity-60">Hand-off: {{ handOff() ?? 'none' }}</p>
      } @else {
        <p class="text-small opacity-60">Value: {{ value()?.toTimeString() ?? 'null' }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...TIME_PICKER_IMPORTS, ProvideColorDirective],
})
export class TimePickerStorybookComponent {
  public mode = input<TimePickerMode>('single');
  public format = input('HH:mm');
  public minuteStep = input(5);
  public locale = input<'default' | 'de'>('default');
  public minTime = input<string | null>(null);
  public maxTime = input<string | null>(null);
  public filter = input<TimePickerFilterPreset>('none');
  public start = input<string | null>(null);
  public end = input<string | null>(null);
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);
  public startDay = input<string | null>(null);
  public endDay = input<string | null>(null);
  public day = input<string | null>(null);
  public color = input('brand');
  public disabled = input(false);

  protected handOff = signal<TimeRangeSide | null>(null);

  public value = linkedSignal<Date | null>(() => (this.mode() === 'range' ? null : parseTimeOfDay(this.start())));

  public rangeValue = linkedSignal<TimeRange>(() => ({
    start: parseTimeOfDay(this.start()),
    end: parseTimeOfDay(this.end()),
  }));

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  protected dayDate = computed(() => parseDay(this.day()));

  protected rangeDaysValue = computed<TimeRange | null>(() => {
    const start = parseDay(this.startDay());
    const end = parseDay(this.endDay());

    return start === null && end === null ? null : { start, end };
  });

  protected minTimeDate = computed(() => parseTimeOfDay(this.minTime()));
  protected maxTimeDate = computed(() => parseTimeOfDay(this.maxTime()));

  protected filterFn = computed<TimePickerTimeFilterFn | null>(() => {
    const preset = this.filter();

    if (preset === 'endAfterStart') {
      return (candidate, side) => {
        if (side === 'start') {
          return true;
        }

        const start = this.rangeValue().start;

        return start === null || candidate > start;
      };
    }

    return resolveTimeFilterPreset(preset);
  });
}
