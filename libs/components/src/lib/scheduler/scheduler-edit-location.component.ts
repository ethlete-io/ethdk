import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { INPUT_IMPORTS } from '../forms/input';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/** The location field. */
@Component({
  selector: 'et-scheduler-edit-location',
  template: `
    <et-form-field>
      <et-label>{{ label() }}</et-label>
      <et-input [value]="value()" (valueChange)="updateLocation($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS],
})
export class SchedulerEditLocationComponent<TExtra = unknown> {
  private labels = injectSchedulerLabels();

  /** The draft to edit - pass the surface's `draft`. */
  public draft = input.required<WritableSignal<Appointment<TExtra>>>();

  public label = computed(() => this.labels().locationField);

  protected value = computed(() => this.draft()().location ?? '');

  protected updateLocation(value: string) {
    this.draft().update((appointment) => ({ ...appointment, location: value || undefined }));
  }
}
