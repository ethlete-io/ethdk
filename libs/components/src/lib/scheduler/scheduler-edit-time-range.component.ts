import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { format, parse } from 'date-fns';
import { injectDateFormat } from '../forms/date-time/date-time-formats';
import { DATE_TIME_RANGE_INPUT_IMPORTS } from '../forms/date-time/date-time-range-input/date-time-range-input.imports';
import { DateTimeRangeValue } from '../forms/date-time/date-time-range-input/headless';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The start/end piece of the edit surface, stamped by `etSchedulerEditTimeRange`.
 *
 * @internal
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
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DATE_TIME_RANGE_INPUT_IMPORTS],
  host: {
    class: 'et-scheduler-edit-time-range',
  },
})
export class SchedulerEditTimeRangeComponent {
  private labels = injectSchedulerLabels();
  private dateFormat = injectDateFormat();

  public draft = input.required<WritableSignal<Appointment>>();

  public label = computed(() => this.labels().timeRangeField);
  public startLabel = computed(() => this.labels().startField);
  public endLabel = computed(() => this.labels().endField);

  protected rangeValue = computed<DateTimeRangeValue>(() => ({
    start: format(this.draft()().start, this.dateFormat),
    end: format(this.draft()().end, this.dateFormat),
  }));

  protected updateRange(value: DateTimeRangeValue) {
    this.draft().update((appointment) => ({
      ...appointment,
      // a cleared side keeps the appointment's own timestamp - the surface has no empty state
      start: value.start === null ? appointment.start : parse(value.start, this.dateFormat, appointment.start),
      end: value.end === null ? appointment.end : parse(value.end, this.dateFormat, appointment.end),
    }));
  }
}
