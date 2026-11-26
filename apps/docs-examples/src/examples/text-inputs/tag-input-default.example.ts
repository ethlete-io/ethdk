import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, TAG_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-tag-input-default-example',
  template: `
    <et-form-field>
      <et-label>Tags</et-label>
      <et-tag-input [formField]="demoForm.tags" placeholder="Add a tag…" />
      <et-hint>Enter or comma commits a tag</et-hint>
    </et-form-field>

    <p>Form value: {{ demoForm.tags().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, TAG_INPUT_IMPORTS, FormField, JsonPipe],
})
export class TagInputDefaultExampleComponent {
  private model = signal({ tags: [] as string[] });

  protected demoForm = form(this.model);
}
