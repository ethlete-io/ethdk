import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-number-input-decimals-example',
  template: `
    <et-form-field>
      <et-label>Amount</et-label>
      <et-number-input
        [formField]="demoForm.amount"
        [decimals]="2"
        [step]="0.25"
        stepper
        parseErrorMessage="Enter an amount"
      />
      <et-hint>At most two fraction digits.</et-hint>
    </et-form-field>

    <p>Model value: {{ demoForm.amount().value() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS, FormField],
})
export class NumberInputDecimalsExampleComponent {
  private model = signal<{ amount: number | null }>({ amount: null });

  protected demoForm = form(this.model);
}
