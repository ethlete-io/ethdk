import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { format, parse } from 'date-fns';
import { DATE_TIME_INPUT_IMPORTS } from '../forms/date-time/date-time-input/date-time-input.imports';
import { injectDateFormat } from '../forms/date-time/date-time-formats';
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
      <et-label>{{ startLabel() }}</et-label>
      <et-date-time-input [value]="startValue()" (valueChange)="updateStart($event)" />
    </et-form-field>

    <et-form-field class="et-scheduler-edit-time-range-field">
      <et-label>{{ endLabel() }}</et-label>
      <et-date-time-input [value]="endValue()" (valueChange)="updateEnd($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...DATE_TIME_INPUT_IMPORTS],
  host: {
    class: 'et-scheduler-edit-time-range',
  },
})
export class SchedulerEditTimeRangeComponent {
  private labels = injectSchedulerLabels();
  private dateFormat = injectDateFormat();

  public draft = input.required<WritableSignal<Appointment>>();

  public startLabel = computed(() => this.labels().startField);
  public endLabel = computed(() => this.labels().endField);

  protected startValue = computed(() => format(this.draft()().start, this.dateFormat));
  protected endValue = computed(() => format(this.draft()().end, this.dateFormat));

  protected updateStart(value: string | null) {
    if (!value) {
      return;
    }

    const start = parse(value, this.dateFormat, this.draft()().start);

    this.draft().update((appointment) => ({ ...appointment, start }));
  }

  protected updateEnd(value: string | null) {
    if (!value) {
      return;
    }

    const end = parse(value, this.dateFormat, this.draft()().end);

    this.draft().update((appointment) => ({ ...appointment, end }));
  }
}
