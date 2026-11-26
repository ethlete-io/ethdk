import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  TIME_RANGE_INPUT_IMPORTS,
  timeRangeOrder,
  TimeRangeTimeFilterFn,
  TimeRangeValue,
} from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

const parseTimeOfDay = (value: string | null) => {
  const [hours, minutes] = (value ?? '').split(':').map(Number);

  return hours === undefined || minutes === undefined || Number.isNaN(hours + minutes)
    ? null
    : setMinutes(setHours(startOfDay(new Date()), hours), minutes);
};

const endAfterStart =
  (getStart: () => string | null): TimeRangeTimeFilterFn =>
  (candidate, side) => {
    if (side === 'start') {
      return true;
    }

    const start = parseTimeOfDay(getStart());

    return start === null || candidate > start;
  };

@Component({
  selector: 'app-time-range-input-end-after-start-example',
  template: `
    <et-form-field>
      <et-label>Time range</et-label>
      <et-time-range-input [formField]="shiftForm.range" [timeFilter]="endAfterStart" />
      <et-hint>The time filter knows which end it is filling, so the end rejects everything up to the start</et-hint>
    </et-form-field>

    <p>Form value: {{ shiftForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class TimeRangeInputEndAfterStartExampleComponent {
  private model = signal<{ range: TimeRangeValue }>({ range: { start: '09:00', end: null } });

  protected shiftForm = form(this.model, (s) => {
    timeRangeOrder(s.range);
  });

  protected readonly endAfterStart = endAfterStart(() => this.shiftForm.range().value().start);
}
