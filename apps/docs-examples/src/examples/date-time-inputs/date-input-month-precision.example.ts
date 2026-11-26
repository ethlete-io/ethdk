import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DATE_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-date-input-month-precision-example',
  template: `
    <et-form-field>
      <et-label>Date</et-label>
      <et-date-input [formField]="eventForm.month" precision="month" valueFormat="yyyy-MM" placeholder="mm/yyyy" />
      <et-hint>A month picker: the format comes from the precision, and the picker selects in its month grid</et-hint>
    </et-form-field>

    <p>Form value: {{ eventForm.month().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateInputMonthPrecisionExampleComponent {
  private model = signal<{ month: string | null }>({ month: null });

  protected eventForm = form(this.model);
}
