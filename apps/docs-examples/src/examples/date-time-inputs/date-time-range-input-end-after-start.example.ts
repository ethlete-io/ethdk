import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  DATE_TIME_RANGE_INPUT_IMPORTS,
  dateTimeRangeOrder,
  DateTimeRangeTimeFilterFn,
  DateTimeRangeValue,
  FORM_FIELD_IMPORTS,
} from '@ethlete/components';
import { parseISO } from 'date-fns';

const endAfterStart =
  (getStart: () => string | null): DateTimeRangeTimeFilterFn =>
  (candidate, side) => {
    if (side === 'start') {
      return true;
    }

    const start = getStart();

    return start === null || candidate > parseISO(start);
  };

@Component({
  selector: 'app-date-time-range-input-end-after-start-example',
  template: `
    <et-form-field>
      <et-label>Date & time range</et-label>
      <et-date-time-range-input [formField]="shiftForm.range" [timeFilter]="endAfterStart" />
      <et-hint
        >The time filter knows which side it is filling, so the end pane rejects everything up to the start</et-hint
      >
    </et-form-field>

    <p>Form value: {{ shiftForm.range().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DATE_TIME_RANGE_INPUT_IMPORTS, FormField, JsonPipe],
})
export class DateTimeRangeInputEndAfterStartExampleComponent {
  private model = signal<{ range: DateTimeRangeValue }>({
    range: { start: '2026-07-16T09:00:00+02:00', end: null },
  });

  protected shiftForm = form(this.model, (s) => {
    dateTimeRangeOrder(s.range);
  });

  protected readonly endAfterStart = endAfterStart(() => this.shiftForm.range().value().start);
}
