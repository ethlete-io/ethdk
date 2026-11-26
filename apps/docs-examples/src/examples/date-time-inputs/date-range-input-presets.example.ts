import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  DATE_RANGE_INPUT_IMPORTS,
  dateRangeOrder,
  DateRangeValue,
  FORM_FIELD_IMPORTS,
  lastDaysPreset,
  lastMonthPreset,
  thisMonthPreset,
  thisYearPreset,
  todayPreset,
} from '@ethlete/components';

@Component({
  selector: 'app-date-range-input-presets-example',
  template: `
    <et-form-field>
      <et-label>Date range</et-label>
      <et-date-range-input [formField]="reportForm.range" [presets]="presets" valueFormat="yyyy-MM-dd" />
    </et-form-field>

    <p>Form value: {{ reportForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateRangeInputPresetsExampleComponent {
  protected readonly presets = [
    todayPreset(),
    lastDaysPreset(7),
    lastDaysPreset(30),
    thisMonthPreset(),
    lastMonthPreset(),
    thisYearPreset(),
  ];

  private model = signal<{ range: DateRangeValue }>({ range: { start: null, end: null } });

  protected reportForm = form(this.model, (s) => {
    dateRangeOrder(s.range, { valueFormat: 'yyyy-MM-dd' });
  });
}
