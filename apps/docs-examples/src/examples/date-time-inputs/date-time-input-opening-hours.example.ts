import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DATE_TIME_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

const isOpen = (date: Date) => {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const hour = date.getHours();

  return isWeekend ? hour >= 10 && hour < 14 : hour >= 9 && hour < 17;
};

@Component({
  selector: 'app-date-time-input-opening-hours-example',
  template: `
    <et-form-field>
      <et-label>Date & time</et-label>
      <et-date-time-input [formField]="visitForm.visit" [timeFilter]="IS_OPEN" />
      <et-hint>The time filter sees the picked day: 09:00-17:00 on weekdays, 10:00-14:00 on weekends</et-hint>
    </et-form-field>

    <p>Form value: {{ visitForm.visit().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeInputOpeningHoursExampleComponent {
  protected readonly IS_OPEN = isOpen;

  private model = signal<{ visit: string | null }>({ visit: '2026-07-16T10:00:00+02:00' });

  protected visitForm = form(this.model);
}
