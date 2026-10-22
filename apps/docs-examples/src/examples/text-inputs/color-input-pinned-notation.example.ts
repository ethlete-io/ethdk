import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { COLOR_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-color-input-pinned-notation-example',
  template: `
    <et-form-field>
      <et-label>Brand color</et-label>
      <et-color-input [formField]="demoForm.brandColor" [notations]="['hex']" />
      <et-hint>
        Pinned to hex: the notation switch is gone, and an entry in another notation is converted with an advisory.
      </et-hint>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, COLOR_INPUT_IMPORTS, FormField],
})
export class ColorInputPinnedNotationExampleComponent {
  private model = signal<{ brandColor: string | null }>({ brandColor: '#3366ff' });

  protected demoForm = form(this.model);
}
