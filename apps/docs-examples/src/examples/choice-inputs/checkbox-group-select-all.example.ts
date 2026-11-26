import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CHECKBOX_GROUP_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-checkbox-group-select-all-example',
  template: `
    <et-checkbox-group [formField]="pizzaForm.toppings">
      <et-label>Select toppings</et-label>
      <et-checkbox-group-select-all />
      @for (topping of TOPPINGS; track topping.value) {
        <et-checkbox-option [value]="topping.value">{{ topping.label }}</et-checkbox-option>
      }
      <et-hint>One control over all of them: unchecked, mixed, checked</et-hint>
    </et-checkbox-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CHECKBOX_GROUP_IMPORTS, FormField],
})
export class CheckboxGroupSelectAllExampleComponent {
  protected readonly TOPPINGS = [
    { value: 'cheese', label: 'Cheese' },
    { value: 'pepperoni', label: 'Pepperoni' },
    { value: 'mushrooms', label: 'Mushrooms' },
  ];

  private model = signal<{ toppings: string[] }>({ toppings: [] });

  protected pizzaForm = form(this.model);
}
