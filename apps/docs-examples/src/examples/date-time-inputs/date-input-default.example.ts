import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DATE_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-date-input-default-example',
  template: `
    <et-form-field>
      <et-label>Date</et-label>
      <et-date-input [formField]="eventForm.date" placeholder="mm/dd/yyyy" />
    </et-form-field>

    <p>Form value: {{ eventForm.date().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateInputDefaultExampleComponent {
  private model = signal<{ date: string | null }>({ date: null });

  protected eventForm = form(this.model);
}
