import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DATE_TIME_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-date-time-input-default-example',
  template: `
    <et-form-field>
      <et-label>Date & time</et-label>
      <et-date-time-input [formField]="eventForm.start" [minuteStep]="5" placeholder="mm/dd/yyyy, hh:mm" />
    </et-form-field>

    <p>Form value: {{ eventForm.start().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeInputDefaultExampleComponent {
  private model = signal<{ start: string | null }>({ start: null });

  protected eventForm = form(this.model);
}
