import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-mixed-state-select-example',
  template: `
    <et-form-field>
      <et-label>Fruit</et-label>
      <et-select
        [(mixed)]="mixed"
        [formField]="fruitForm.fruit"
        mixedLabel="Different values"
        placeholder="Pick a fruit"
      >
        @for (fruit of FRUITS; track fruit.value) {
          <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
        }
      </et-select>
      <et-hint>The raw value stays intact until a user commits a new selection.</et-hint>
    </et-form-field>

    <p>Mixed: {{ mixed() }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField],
})
export class MixedStateSelectExampleComponent {
  protected readonly FRUITS = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
  ];

  protected mixed = signal(true);

  private model = signal({ fruit: 'banana' as string | null });

  protected fruitForm = form(this.model);
}
