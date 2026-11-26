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
  selector: 'app-date-time-range-input-time-zone-example',
  template: `
    <et-form-field>
      <et-label>Broadcast window</et-label>
      <et-date-time-range-input
        [formField]="windowForm.range"
        timeZone="Asia/Tokyo"
        displayFormat="MM/dd/yyyy, HH:mm"
      />
      <et-hint>Both fields read in the venue zone. The line under them is the same window where you are.</et-hint>
    </et-form-field>

    <p>Form value: {{ windowForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeRangeInputTimeZoneExampleComponent {
  private model = signal<{ range: DateTimeRangeValue }>({
    range: { start: '2026-08-18T14:00:00+09:00', end: '2026-08-18T18:00:00+09:00' },
  });

  protected windowForm = form(this.model, (s) => {
    dateTimeRangeOrder(s.range);
  });
}
