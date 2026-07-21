import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../../form-field';
import { DURATION_INPUT_IMPORTS } from '../duration-input.imports';

@Component({
  selector: 'et-sb-duration-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-duration-input
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [durationFormat]="durationFormat()"
          [placeholder]="placeholder()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() ?? 'null' }} ms</p>
      @if (showMixedState()) {
        <p class="text-sm opacity-60">Mixed: {{ mixedState() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DURATION_INPUT_IMPORTS, FormField, ProvideColorDirective],
})
export class DurationInputStorybookComponent {
  public label = input('Lap time');
  public hint = input('');
  public placeholder = input('mm:ss');
  public durationFormat = input('mm:ss');
  public value = input<number | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.value, { when: () => this.required(), message: 'Please enter a duration' });
  });
}
