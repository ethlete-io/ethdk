import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly, validate } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { parseTimeOfDay, resolveTimeFilterPreset } from '../../../../time-picker/stories/time-filter-presets';
import { FORM_FIELD_IMPORTS } from '../../../form-field';
import { DATE_TIME_RANGE_INPUT_IMPORTS } from '../date-time-range-input.imports';
import { DateTimeRangeTimeFilterFn, DateTimeRangeValue } from '../headless';

/**
 * `'endAfterStart'` is the one only a range can express: it reads the committed start and rejects
 * every end time at or before it. The others come from the shared time-picker presets.
 */
export type DateTimeRangeFilterPreset = 'none' | 'noLunchBreak' | 'weekdayHours' | 'endAfterStart';

@Component({
  selector: 'et-sb-date-time-range-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-3xl flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-date-time-range-input
          [(mixed)]="mixedState"
          [formField]="demoForm.range"
          [mixedLabel]="mixedLabel()"
          [startPlaceholder]="startPlaceholder()"
          [endPlaceholder]="endPlaceholder()"
          [valueFormat]="valueFormat()"
          [displayFormat]="displayFormat()"
          [locale]="localeObject()"
          [mask]="mask()"
          [minuteStep]="minuteStep()"
          [secondStep]="secondStep()"
          [minTime]="minTimeDate()"
          [maxTime]="maxTimeDate()"
          [timeFilter]="filterFn()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.range().value() | json }}</p>
      @if (showMixedState()) {
        <p class="text-sm opacity-60">Mixed: {{ mixedState() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DATE_TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class DateTimeRangeInputStorybookComponent {
  public label = input('Date & time range');
  public startPlaceholder = input('Start');
  public endPlaceholder = input('End');
  public hint = input('');
  public start = input<string | null>(null);
  public end = input<string | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public valueFormat = input<string | undefined>(undefined);
  public displayFormat = input('Pp');
  public mask = input(false);
  public minuteStep = input(5);
  public secondStep = input(1);
  /** `HH:mm` bounds - the story turns them into the `Date`s the input takes. */
  public minTime = input<string | null>(null);
  public maxTime = input<string | null>(null);
  public filter = input<DateTimeRangeFilterPreset>('none');
  public locale = input<'default' | 'de'>('default');
  public disabled = input(false);
  public readonly = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  protected minTimeDate = computed(() => parseTimeOfDay(this.minTime()));
  protected maxTimeDate = computed(() => parseTimeOfDay(this.maxTime()));

  private formModel = linkedSignal(() => ({
    range: { start: this.start(), end: this.end() } as DateTimeRangeValue,
  }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.range, () => this.readonly());
    // the control never reorders the two ends - ordering is a validator's job, and a
    // range-level one surfaces in the field's error area
    validate(s.range, ({ value }) => {
      const { start, end } = value();

      return start !== null && end !== null && start > end
        ? { kind: 'range-order', message: 'The start must be before the end' }
        : null;
    });
  });

  protected filterFn = computed<DateTimeRangeTimeFilterFn | null>(() => {
    const preset = this.filter();

    if (preset === 'endAfterStart') {
      return (candidate, side) => {
        if (side === 'start') {
          return true;
        }

        // read inside the closure, so the picker re-filters when the start moves
        const start = this.demoForm.range().value().start;

        return start === null || candidate > parseISO(start);
      };
    }

    const shared = resolveTimeFilterPreset(preset);

    return shared === null ? null : (candidate) => shared(candidate);
  });
}
