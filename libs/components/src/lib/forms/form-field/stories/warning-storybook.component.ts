import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { INPUT_IMPORTS } from '../../input';
import { SLIDER_IMPORTS } from '../../slider';
import { warn } from '../headless';
import { FORM_FIELD_IMPORTS } from '../form-field.imports';

const COMMON_PASSWORDS = ['hunter22', 'password1', 'letmein12'];

@Component({
  selector: 'et-sb-form-field-warning',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-8 p-8 font-sans">
      <!-- Warned and valid at once: type fewer than 8 characters and the error takes the slot back. -->
      <et-form-field>
        <et-label>Password</et-label>
        <et-input [formField]="signupForm.password" type="password" />
        <et-hint>At least 8 characters.</et-hint>
      </et-form-field>

      <et-form-field>
        <et-label>Quantity</et-label>
        <et-input [formField]="signupForm.quantity" type="number" />
        <et-hint>We usually keep {{ STOCK }} in stock.</et-hint>
      </et-form-field>

      <!-- Controls that render their own support region show warnings in the same place. -->
      <et-slider [formField]="signupForm.budget" [max]="200">
        <et-label>Budget</et-label>
        <et-hint>Anything up to 150 is typical.</et-hint>
      </et-slider>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, ...SLIDER_IMPORTS, FormField, ProvideColorDirective],
})
export class FormFieldWarningStorybookComponent {
  public color = input('brand');

  protected readonly STOCK = 100;

  private model = linkedSignal(() => ({ password: 'hunter22', quantity: 140, budget: 180 }));

  public signupForm = form(this.model, (s) => {
    required(s.password, { message: 'Pick a password' });
    minLength(s.password, 8, { message: 'Use at least 8 characters' });

    warn(s.password, ({ value }) =>
      COMMON_PASSWORDS.includes(value()) ? 'This password appears in every leaked-password list.' : null,
    );

    warn(s.quantity, ({ value }) =>
      value() > this.STOCK ? { kind: 'aboveStock', message: 'More than we usually have in stock.' } : null,
    );

    warn(s.budget, ({ value }) => (value() > 150 ? 'Well above the average for this tier.' : null));
  });
}
