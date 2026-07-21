import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { de } from 'date-fns/locale';
import { FORM_FIELD_IMPORTS } from '../../../form-field';
import { DATE_TIME_INPUT_IMPORTS } from '../date-time-input.imports';

@Component({
  selector: 'et-sb-date-time-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-date-time-input
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [placeholder]="placeholder()"
          [valueFormat]="valueFormat()"
          [displayFormat]="displayFormat()"
          [locale]="localeObject()"
          [minuteStep]="minuteStep()"
          [secondStep]="secondStep()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
      @if (showMixedState()) {
        <p class="text-sm opacity-60">Mixed: {{ mixedState() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DATE_TIME_INPUT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class DateTimeInputStorybookComponent {
  public label = input('Date & time');
  public placeholder = input('mm/dd/yyyy, hh:mm');
  public hint = input('');
  public value = input<string | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public valueFormat = input<string | undefined>(undefined);
  public displayFormat = input('Pp');
  public minuteStep = input(5);
  public secondStep = input(1);
  public locale = input<'default' | 'de'>('default');
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  protected localeObject = computed(() => (this.locale() === 'de' ? de : null));

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'Please pick a date and time' });
  });
}
