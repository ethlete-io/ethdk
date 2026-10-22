import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, PHONE_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-phone-input-default-example',
  template: `
    <et-form-field>
      <et-label>Phone number</et-label>
      <et-phone-input
        [formField]="demoForm.phone"
        [preferredCountries]="['de', 'at', 'ch']"
        defaultCountry="de"
        placeholder="170 1234567"
      />
    </et-form-field>

    <p>Form value: {{ demoForm.phone().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, PHONE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class PhoneInputDefaultExampleComponent {
  private model = signal({ phone: '' });

  protected demoForm = form(this.model);
}
