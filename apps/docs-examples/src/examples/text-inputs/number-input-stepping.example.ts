import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-number-input-stepping-example',
  template: `
    <et-form-field>
      <et-label>Quantity</et-label>
      <et-number-input [formField]="demoForm.quantity" stepper />
      <et-hint>Drag a stepper button sideways to scrub. Shift steps 10×, Alt a tenth, Page Up/Down 100×.</et-hint>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, NUMBER_INPUT_IMPORTS, FormField],
})
export class NumberInputSteppingExampleComponent {
  private model = signal<{ quantity: number | null }>({ quantity: 0 });

  protected demoForm = form(this.model);
}
