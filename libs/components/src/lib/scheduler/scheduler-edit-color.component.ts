import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { INPUT_IMPORTS } from '../forms/input';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The color piece of the edit surface, stamped by `etSchedulerEditColor`. A plain text field for
 * `colorToken` rather than a swatch picker - theme names are app-registered (see `theming`), so
 * the SDK has no fixed set of tokens to offer as choices.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-edit-color',
  template: `
    <et-form-field>
      <et-label>{{ label() }}</et-label>
      <et-input [value]="value()" (valueChange)="updateColorToken($event)" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS],
})
export class SchedulerEditColorComponent {
  private labels = injectSchedulerLabels();

  public draft = input.required<WritableSignal<Appointment>>();

  public label = computed(() => this.labels().colorField);

  protected value = computed(() => this.draft()().colorToken ?? '');

  protected updateColorToken(value: string) {
    this.draft().update((appointment) => ({ ...appointment, colorToken: value || undefined }));
  }
}
