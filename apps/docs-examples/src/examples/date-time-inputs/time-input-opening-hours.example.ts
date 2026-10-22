import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, TIME_INPUT_IMPORTS } from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

const atTime = (hours: number, minutes: number) => setMinutes(setHours(startOfDay(new Date()), hours), minutes);

const isNotLunch = (date: Date) => date.getHours() !== 12;

@Component({
  selector: 'app-time-input-opening-hours-example',
  template: `
    <et-form-field>
      <et-label>Time</et-label>
      <et-time-input [formField]="visitForm.time" [minTime]="OPENING" [maxTime]="CLOSING" [timeFilter]="IS_NOT_LUNCH" />
      <et-hint>The picker only offers 09:00-17:30, lunch hour excluded</et-hint>
    </et-form-field>

    <p>Form value: {{ visitForm.time().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, TIME_INPUT_IMPORTS, FormField, JsonPipe],
})
export class TimeInputOpeningHoursExampleComponent {
  protected readonly OPENING = atTime(9, 0);
  protected readonly CLOSING = atTime(17, 30);

  protected readonly IS_NOT_LUNCH = isNotLunch;

  private model = signal<{ time: string | null }>({ time: null });

  protected visitForm = form(this.model);
}
