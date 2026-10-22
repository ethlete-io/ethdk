import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-select-all-example',
  template: `
    <et-form-field>
      <et-label>Fruits</et-label>
      <et-select [formField]="fruitForm.FRUITS" placeholder="Pick FRUITS" multiple selectAll>
        <input etSelectSearch placeholder="Search FRUITS" />
        @for (fruit of FRUITS; track fruit.value) {
          <et-select-option [value]="fruit.value" [disabled]="fruit.value === 'elderberry'">
            {{ fruit.label }}
          </et-select-option>
        }
      </et-select>
      <et-hint>Select all adds every visible, enabled option - Elderberry is disabled and stays out</et-hint>
    </et-form-field>

    <p>Form value: {{ fruitForm.FRUITS().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectAllExampleComponent {
  protected readonly FRUITS = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'dragonfruit', label: 'Dragonfruit' },
    { value: 'elderberry', label: 'Elderberry' },
    { value: 'fig', label: 'Fig' },
    { value: 'grape', label: 'Grape' },
  ];

  private model = signal({ FRUITS: ['apple'] });

  protected fruitForm = form(this.model);
}
