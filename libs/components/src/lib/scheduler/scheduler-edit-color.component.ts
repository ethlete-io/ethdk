import { Component, computed, input, ViewEncapsulation, WritableSignal } from '@angular/core';
import { injectColorPalette, ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { INPUT_IMPORTS } from '../forms/input';
import { RADIO_GROUP_IMPORTS } from '../forms/selection-list';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/**
 * The color field: a swatch picker over the app's `provideColorPalette` palette, or - with no
 * palette in scope - a plain text field for `colorToken`, since theme names are app-registered.
 */
@Component({
  selector: 'et-scheduler-edit-color',
  template: `
    @if (palette; as entries) {
      <et-radio-group [value]="selectedToken()" (valueChange)="selectColorToken($event)" orientation="horizontal">
        <et-label>{{ label() }}</et-label>

        <et-radio [value]="null">
          <span class="et-scheduler-edit-color-swatch" aria-hidden="true" data-empty></span>
          {{ noneLabel() }}
        </et-radio>

        @for (entry of entries; track entry.token) {
          <et-radio [value]="entry.token" [etProvideColor]="entry.token">
            <span class="et-scheduler-edit-color-swatch" aria-hidden="true"></span>
            {{ entry.label }}
          </et-radio>
        }
      </et-radio-group>
    } @else {
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-input [value]="textValue()" (valueChange)="updateColorToken($event)" />
      </et-form-field>
    }
  `,
  styleUrl: './scheduler-edit-color.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, ...RADIO_GROUP_IMPORTS, ProvideColorDirective],
})
export class SchedulerEditColorComponent<TExtra = unknown> {
  private labels = injectSchedulerLabels();

  protected palette = injectColorPalette({ optional: true });

  /** The draft to edit - pass the surface's `draft`. */
  public draft = input.required<WritableSignal<Appointment<TExtra>>>();

  public label = computed(() => this.labels().colorField);

  protected noneLabel = computed(() => this.labels().colorFieldNone);

  protected textValue = computed(() => this.draft()().colorToken ?? '');

  protected selectedToken = computed(() => this.draft()().colorToken ?? null);

  protected selectColorToken(value: unknown) {
    this.updateColorToken(typeof value === 'string' ? value : '');
  }

  protected updateColorToken(value: string) {
    this.draft().update((appointment) => ({ ...appointment, colorToken: value || undefined }));
  }
}
