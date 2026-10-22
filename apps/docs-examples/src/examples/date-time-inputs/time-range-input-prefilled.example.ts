import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS, timeRangeOrder, TimeRangeValue } from '@ethlete/components';

@Component({
  selector: 'app-time-range-input-prefilled-example',
  template: `
    <et-form-field>
      <et-label>Time range</et-label>
      <et-time-range-input [formField]="shiftForm.range" />
      <et-hint>One set of columns holds both ends - the side switch says which one a pick fills</et-hint>
    </et-form-field>

    <p>Form value: {{ shiftForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class TimeRangeInputPrefilledExampleComponent {
  private model = signal<{ range: TimeRangeValue }>({ range: { start: '09:00', end: '17:30' } });

  protected shiftForm = form(this.model, (s) => {
    timeRangeOrder(s.range);
  });
}
