import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { TEXTAREA_IMPORTS } from '../forms/textarea';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The description piece of the edit surface, stamped by `etSchedulerEditDescription`.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-edit-description',
  template: `
    <et-form-field>
      <et-label>{{ label() }}</et-label>
      <et-textarea [value]="value()" (valueChange)="updateDescription($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...TEXTAREA_IMPORTS],
})
export class SchedulerEditDescriptionComponent {
  private labels = injectSchedulerLabels();

  public draft = input.required<WritableSignal<Appointment>>();

  public label = computed(() => this.labels().descriptionField);

  protected value = computed(() => this.draft()().description ?? '');

  protected updateDescription(value: string) {
    this.draft().update((appointment) => ({ ...appointment, description: value || undefined }));
  }
}
