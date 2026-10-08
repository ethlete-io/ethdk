import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { TEXTAREA_IMPORTS } from '../forms/textarea';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/** The description field. */
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
export class SchedulerEditDescriptionComponent<TExtra = unknown> {
  private labels = injectSchedulerLabels();

  /** The draft to edit - pass the surface's `draft`. */
  public draft = input.required<WritableSignal<Appointment<TExtra>>>();

  public label = computed(() => this.labels().descriptionField);

  protected value = computed(() => this.draft()().description ?? '');

  protected updateDescription(value: string) {
    this.draft().update((appointment) => ({ ...appointment, description: value || undefined }));
  }
}
