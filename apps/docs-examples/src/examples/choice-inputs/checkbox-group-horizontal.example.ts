import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CHECKBOX_GROUP_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-checkbox-group-horizontal-example',
  template: `
    <et-checkbox-group [formField]="sizeForm.sizes" orientation="horizontal">
      <et-label>Sizes</et-label>
      @for (size of SIZES; track size) {
        <et-checkbox-option [value]="size">{{ size }}</et-checkbox-option>
      }
    </et-checkbox-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CHECKBOX_GROUP_IMPORTS, FormField],
})
export class CheckboxGroupHorizontalExampleComponent {
  protected readonly SIZES = ['Small', 'Medium', 'Large', 'Extra large'];

  private model = signal<{ sizes: string[] }>({ sizes: [] });

  protected sizeForm = form(this.model);
}
