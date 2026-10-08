import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { INPUT_IMPORTS } from '../forms/input';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The title field. Required: `valid()` is `false` while the draft's title is blank - bind it to the
 * footer's `canSave`.
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
export class SchedulerEditTitleComponent<TExtra = unknown> {
  private labels = injectSchedulerLabels();

  /** The draft to edit - pass the surface's `draft`. */
  public draft = input.required<WritableSignal<Appointment<TExtra>>>();

  public label = computed(() => this.labels().titleField);

  public valid = computed(() => this.draft()().title.trim().length > 0);

  protected value = computed(() => this.draft()().title);

  protected updateTitle(value: string) {
    this.draft().update((appointment) => ({ ...appointment, title: value }));
  }
}
