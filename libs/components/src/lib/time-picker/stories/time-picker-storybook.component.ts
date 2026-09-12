import { Component, ViewEncapsulation, computed, input, linkedSignal, signal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { TimePickerMode, TimePickerTimeFilterFn, TimeRange } from '../headless';
import { TIME_PICKER_IMPORTS } from '../time-picker.imports';
import { TimeFilterPreset, parseTimeOfDay, resolveTimeFilterPreset } from './time-filter-presets';

export type TimePickerFilterPreset = TimeFilterPreset | 'endAfterStart';

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
        [secondStep]="secondStep()"
        [min]="minTimeDate()"
        [max]="maxTimeDate()"
        [timeFilter]="filterFn()"
        [startLabel]="startLabel()"
        [endLabel]="endLabel()"
      />

      @if (mode() === 'range') {
        <p class="text-sm opacity-60">
          Start: {{ rangeValue().start?.toTimeString() ?? 'null' }} · End:
          {{ rangeValue().end?.toTimeString() ?? 'null' }}
        </p>
      } @else {
        <p class="text-sm opacity-60">Value: {{ value()?.toTimeString() ?? 'null' }}</p>
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
  public secondStep = input(1);
  public locale = input<'default' | 'de'>('default');
  public minTime = input<string | null>(null);
  public maxTime = input<string | null>(null);
  public filter = input<TimePickerFilterPreset>('none');
  public start = input<string | null>(null);
  public end = input<string | null>(null);
  public startLabel = input<string | null>(null);
  public endLabel = input<string | null>(null);
  public color = input('brand');

  public value = signal<Date | null>(null);

  public rangeValue = linkedSignal<TimeRange>(() => ({
    start: parseTimeOfDay(this.start()),
    end: parseTimeOfDay(this.end()),
  }));

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

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
