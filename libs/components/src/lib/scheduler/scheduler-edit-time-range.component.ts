import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { format, parse } from 'date-fns';
import { injectDateTimeFormat } from '../forms/date-time/date-time-formats';
import { DATE_TIME_RANGE_INPUT_IMPORTS } from '../forms/date-time/date-time-range-input/date-time-range-input.imports';
import { DateTimeRangeValue } from '../forms/date-time/date-time-range-input/headless';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The start/end field, one date-time range input. `valid()` is `false` while `end` is before
 * `start` - bind it to the footer's `canSave`.
 */
@Component({
  selector: 'et-scheduler-edit-time-range',
  template: `
    <et-form-field class="et-scheduler-edit-time-range-field">
      <et-label>{{ label() }}</et-label>
      <et-date-time-range-input
        [value]="rangeValue()"
        [startAriaLabel]="startLabel()"
        [endAriaLabel]="endLabel()"
        (valueChange)="updateRange($event)"
      />
    </et-form-field>
  `,
  styleUrl: './scheduler-edit-time-range.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DATE_TIME_RANGE_INPUT_IMPORTS],
  host: {
    class: 'et-scheduler-edit-time-range',
  },
})
export class SchedulerEditTimeRangeComponent<TExtra = unknown> {
  private labels = injectSchedulerLabels();
  private dateTimeFormat = injectDateTimeFormat();

  /** The draft to edit - pass the surface's `draft`. */
  public draft = input.required<WritableSignal<Appointment<TExtra>>>();

  public label = computed(() => this.labels().timeRangeField);
  public startLabel = computed(() => this.labels().startField);
  public endLabel = computed(() => this.labels().endField);

  public valid = computed(() => this.draft()().end >= this.draft()().start);

  protected rangeValue = computed<DateTimeRangeValue>(() => ({
    start: format(this.draft()().start, this.dateTimeFormat),
    end: format(this.draft()().end, this.dateTimeFormat),
  }));

  protected updateRange(value: DateTimeRangeValue) {
    this.draft().update((appointment) => ({
      ...appointment,
      start: value.start === null ? appointment.start : parse(value.start, this.dateTimeFormat, appointment.start),
      end: value.end === null ? appointment.end : parse(value.end, this.dateTimeFormat, appointment.end),
    }));
  }
}
