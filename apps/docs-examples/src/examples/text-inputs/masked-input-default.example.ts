import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS, MASKED_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-masked-input-default-example',
  template: `
    <et-form-field>
      <et-label>Date</et-label>
      <et-input [formField]="demoForm.date" etInputMask="00-00-0000" />
    </et-form-field>

    <p>Form value: "{{ demoForm.date().value() }}"</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, MASKED_INPUT_IMPORTS, FormField],
})
export class MaskedInputDefaultExampleComponent {
  private model = signal({ date: '' });

  protected demoForm = form(this.model);
}
