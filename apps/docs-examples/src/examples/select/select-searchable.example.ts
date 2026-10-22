import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-select-searchable-example',
  template: `
    <et-form-field>
      <et-label>Fruit</et-label>
      <et-select [formField]="fruitForm.fruit" placeholder="Pick a fruit">
        <input etSelectSearch placeholder="Search FRUITS" />
        @for (fruit of FRUITS; track fruit.value) {
          <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
        }
      </et-select>
    </et-form-field>

    <p>Form value: {{ fruitForm.fruit().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectSearchableExampleComponent {
  protected readonly FRUITS = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'dragonfruit', label: 'Dragonfruit' },
    { value: 'elderberry', label: 'Elderberry' },
    { value: 'fig', label: 'Fig' },
    { value: 'grape', label: 'Grape' },
  ];

  private model = signal({ fruit: null as string | null });

  protected fruitForm = form(this.model);
}
