import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';

@Component({
  selector: 'et-sb-phone-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-phone-input
          [formField]="demoForm.value"
          [defaultCountry]="defaultCountry()"
          [preferredCountries]="preferredCountries()"
          [placeholder]="placeholder()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...PHONE_INPUT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class PhoneInputStorybookComponent {
  public label = input('Phone number');
  public placeholder = input('170 1234567');
  public hint = input('');
  public value = input('');
  public defaultCountry = input('de');
  public preferredCountries = input<string[]>(['de', 'at', 'ch']);
  public disabled = input(false);
  public readonly = input(false);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
  });
}
