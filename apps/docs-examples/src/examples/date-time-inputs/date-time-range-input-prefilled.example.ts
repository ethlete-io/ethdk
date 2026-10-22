import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  DATE_TIME_RANGE_INPUT_IMPORTS,
  dateTimeRangeOrder,
  DateTimeRangeValue,
  FORM_FIELD_IMPORTS,
} from '@ethlete/components';

@Component({
  selector: 'app-date-time-range-input-prefilled-example',
  template: `
    <et-form-field>
      <et-label>Date & time range</et-label>
      <et-date-time-range-input [formField]="shiftForm.range" />
      <et-hint>A same-day range: pick the day once, then a time per side</et-hint>
    </et-form-field>

    <p>Form value: {{ shiftForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeRangeInputPrefilledExampleComponent {
  private model = signal<{ range: DateTimeRangeValue }>({
    range: { start: '2026-07-16T09:00:00+02:00', end: '2026-07-16T17:30:00+02:00' },
  });

  protected shiftForm = form(this.model, (s) => {
    dateTimeRangeOrder(s.range);
  });
}
