import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-select-multiple-example',
  template: `
    <et-form-field>
      <et-label>Fruits</et-label>
      <et-select [formField]="fruitForm.FRUITS" placeholder="Pick FRUITS" multiple>
        @for (fruit of FRUITS; track fruit.value) {
          <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
        }
      </et-select>
    </et-form-field>

    <p>Form value: {{ fruitForm.FRUITS().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectMultipleExampleComponent {
  protected readonly FRUITS = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'dragonfruit', label: 'Dragonfruit' },
    { value: 'fig', label: 'Fig' },
    { value: 'grape', label: 'Grape' },
  ];

  private model = signal({ FRUITS: ['apple', 'cherry'] });

  protected fruitForm = form(this.model);
}
