import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DATE_TIME_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-date-time-input-time-zone-example',
  template: `
    <et-form-field>
      <et-label>Doors open</et-label>
      <et-date-time-input [formField]="eventForm.doors" timeZone="Asia/Tokyo" displayFormat="MM/dd/yyyy, HH:mm" />
      <et-hint>The field reads in the venue zone. The line under it is the same moment where you are.</et-hint>
    </et-form-field>

    <p>Form value: {{ eventForm.doors().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeInputTimeZoneExampleComponent {
  private model = signal<{ doors: string | null }>({ doors: '2026-08-18T14:00:00+09:00' });

  protected eventForm = form(this.model);
}
