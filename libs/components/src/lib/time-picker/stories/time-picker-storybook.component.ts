import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { TIME_PICKER_IMPORTS } from '../time-picker.imports';
import { TimeFilterPreset, parseTimeOfDay, resolveTimeFilterPreset } from './time-filter-presets';

@Component({
  selector: 'et-sb-time-picker',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col items-start gap-4 p-8 font-sans">
      <et-time-picker
        [(value)]="value"
        [format]="format()"
        [locale]="localeObject()"
        [minuteStep]="minuteStep()"
        [secondStep]="secondStep()"
        [min]="minTimeDate()"
        [max]="maxTimeDate()"
        [timeFilter]="filterFn()"
      />

      <p class="text-sm opacity-60">Value: {{ value()?.toTimeString() ?? 'null' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...TIME_PICKER_IMPORTS, ProvideColorDirective],
})
export class TimePickerStorybookComponent {
  public format = input('HH:mm');
  public minuteStep = input(5);
  public secondStep = input(1);
  public locale = input<'default' | 'de'>('default');
  /** `HH:mm` bounds — the story turns them into the `Date`s the picker takes. */
  public minTime = input<string | null>(null);
  public maxTime = input<string | null>(null);
  public filter = input<TimeFilterPreset>('none');
  public color = input('brand');

  public value = signal<Date | null>(null);

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  protected minTimeDate = computed(() => parseTimeOfDay(this.minTime()));
  protected maxTimeDate = computed(() => parseTimeOfDay(this.maxTime()));
  protected filterFn = computed(() => resolveTimeFilterPreset(this.filter()));
}
