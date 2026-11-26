import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-select-custom-values-example',
  template: `
    <et-form-field>
      <et-label>Tags</et-label>
      <et-select
        [formField]="tagForm.tags"
        [separators]="[',']"
        placeholder="Pick or create tags"
        multiple
        allowCustomValues
        commitCustomValueOnClose
      >
        <input etSelectSearch placeholder="Search tags" />
        @for (tag of TAGS; track tag) {
          <et-select-option [value]="tag">{{ tag }}</et-select-option>
        }
      </et-select>
      <et-hint>Comma commits while typing, pastes split on commas/newlines, pending text commits on close</et-hint>
    </et-form-field>

    <p>Form value: {{ tagForm.tags().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectCustomValuesExampleComponent {
  protected readonly TAGS = ['frontend', 'backend', 'design', 'research'];

  private model = signal({ tags: [] as string[] });

  protected tagForm = form(this.model);
}
