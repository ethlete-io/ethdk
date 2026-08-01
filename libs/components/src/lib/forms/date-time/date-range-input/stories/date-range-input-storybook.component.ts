import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly, validate } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { FORM_FIELD_IMPORTS } from '../../../form-field';
import { DateRangeValue } from '../headless';
import { DATE_RANGE_INPUT_IMPORTS } from '../date-range-input.imports';
import { CalendarPrecision } from '../../../../calendar/headless';

@Component({
  selector: 'et-sb-date-range-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-date-range-input
          [(mixed)]="mixedState"
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
  public disabled = input(false);
  public readonly = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  private formModel = linkedSignal(() => ({ range: { start: this.start(), end: this.end() } as DateRangeValue }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.range, () => this.readonly());
    // range-level validation surfaces in the field's error area (child-path
    // validators only flip the invalid state - their messages stay on the sub-fields)
    validate(s.range, ({ value }) => {
      const { start, end } = value();

      return start !== null && end !== null && start > end
        ? { kind: 'range-order', message: 'The start date must be before the end date' }
        : null;
    });
  });
}
