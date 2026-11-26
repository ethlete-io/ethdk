import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { FORM_FIELD_IMPORTS } from '../../../form-field';
import {
  lastDaysPreset,
  lastMonthPreset,
  thisMonthPreset,
  thisYearPreset,
  todayPreset,
} from '../../date-range-presets';
import { dateRangeOrder } from '../../date-time-range-validators';
import { DateRangeValue } from '../headless';
import { DATE_RANGE_INPUT_IMPORTS } from '../date-range-input.imports';
import { CalendarPrecision } from '../../../../calendar/headless';

@Component({
  selector: 'et-sb-date-range-input',
  template: `
    <div
      [etProvideColor]="color()"
      [style.max-inline-size.px]="maxInlineSize()"
      class="flex flex-col gap-4 p-8 font-sans"
    >
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-date-range-input
          [(mixed)]="mixedState"
          [presets]="presetList()"
          [formField]="demoForm.range"
          [mixedLabel]="mixedLabel()"
          [startPlaceholder]="startPlaceholder()"
          [endPlaceholder]="endPlaceholder()"
          [valueFormat]="valueFormat()"
          [displayFormat]="displayFormat()"
          [precision]="precision()"
          [locale]="localeObject()"
          [mask]="mask()"
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
  imports: [...FORM_FIELD_IMPORTS, ...DATE_RANGE_INPUT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class DateRangeInputStorybookComponent {
  public label = input('Date range');
  public startPlaceholder = input('mm/dd/yyyy');
  public endPlaceholder = input('mm/dd/yyyy');
  public hint = input('');
  public start = input<string | null>(null);
  public end = input<string | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public valueFormat = input<string | undefined>('yyyy-MM-dd');
  public displayFormat = input<string | null>(null);
  public precision = input<CalendarPrecision>('day');
  public mask = input(false);
  public locale = input<'default' | 'de'>('default');
  public withPresets = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public color = input('brand');
  public maxInlineSize = input(480);

  public mixedState = linkedSignal(() => this.mixed());

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  private formModel = linkedSignal(() => ({ range: { start: this.start(), end: this.end() } as DateRangeValue }));

  protected presetList = computed(() =>
    this.withPresets()
      ? [todayPreset(), lastDaysPreset(7), lastDaysPreset(30), thisMonthPreset(), lastMonthPreset(), thisYearPreset()]
      : [],
  );

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.range, () => this.readonly());
    dateRangeOrder(s.range, { valueFormat: this.valueFormat() });
  });
}
