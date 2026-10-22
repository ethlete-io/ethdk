import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-input-default-example',
  template: `
    <et-form-field appearance="box" labelMode="floating-inside">
      <et-label>Email</et-label>
      <span etInputPrefix>&#64;</span>
      <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
      <et-hint>We never share your email.</et-hint>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, FormField],
})
export class InputDefaultExampleComponent {
  private model = signal({ email: '' });

  protected demoForm = form(this.model);
}
