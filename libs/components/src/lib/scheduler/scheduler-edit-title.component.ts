import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { INPUT_IMPORTS } from '../forms/input';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The title piece of the edit surface, stamped by `etSchedulerEditTitle`.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-edit-title',
  template: `
    <et-form-field>
      <et-label>{{ label() }}</et-label>
      <et-input [value]="value()" (valueChange)="updateTitle($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS],
})
export class SchedulerEditTitleComponent {
  private labels = injectSchedulerLabels();

  public draft = input.required<WritableSignal<Appointment>>();

  public label = computed(() => this.labels().titleField);

  protected value = computed(() => this.draft()().title);

  protected updateTitle(value: string) {
    this.draft().update((appointment) => ({ ...appointment, title: value }));
  }
}
