import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, max, minLength, required } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS, NUMBER_INPUT_IMPORTS, SLIDER_IMPORTS, warn } from '@ethlete/components';

const STOCK = 100;
const COMMON_PASSWORDS = ['hunter22', 'password1', 'letmein12'];

@Component({
  selector: 'app-form-field-warning-example',
  template: `
    <et-form-field>
      <et-label>Password</et-label>
      <et-input [formField]="signupForm.password" type="password" />
      <et-hint>At least 8 characters.</et-hint>
    </et-form-field>

    <et-form-field>
      <et-label>Quantity</et-label>
      <et-number-input [formField]="signupForm.quantity" />
      <et-hint>We usually keep {{ STOCK }} in stock.</et-hint>
    </et-form-field>

    <et-slider [formField]="signupForm.budget">
      <et-label>Budget</et-label>
      <et-hint>Anything up to 150 is typical.</et-hint>
    </et-slider>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, NUMBER_INPUT_IMPORTS, SLIDER_IMPORTS, FormField],
})
export class FormFieldWarningExampleComponent {
  protected readonly STOCK = STOCK;

  private model = signal({ password: 'hunter22', quantity: 140, budget: 180 });

  protected signupForm = form(this.model, (s) => {
    required(s.password, { message: 'Pick a password' });
    minLength(s.password, 8, { message: 'Use at least 8 characters' });

    warn(s.password, ({ value }) =>
      COMMON_PASSWORDS.includes(value()) ? 'This password appears in every leaked-password list.' : null,
    );

    warn(s.quantity, ({ value }) =>
      value() > STOCK ? { kind: 'aboveStock', message: 'More than we usually have in stock.' } : null,
    );

    max(s.budget, 200);
    warn(s.budget, ({ value }) => (value() > 150 ? 'Well above the average for this tier.' : null));
  });
}
