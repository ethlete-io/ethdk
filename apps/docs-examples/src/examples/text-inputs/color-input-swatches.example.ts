import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { COLOR_INPUT_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-color-input-swatches-example',
  template: `
    <et-form-field>
      <et-label>Brand color</et-label>
      <et-color-input [formField]="demoForm.brandColor" [swatches]="SWATCHES" />
      <et-hint>Presets are given in any notation the color validators accept and render as canonical hex.</et-hint>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, COLOR_INPUT_IMPORTS, FormField],
})
export class ColorInputSwatchesExampleComponent {
  protected readonly SWATCHES = ['#ff5533', '#33bb88', '#3366ff', '#ffcc00', '#111111', '#ffffff'];

  private model = signal<{ brandColor: string | null }>({ brandColor: null });

  protected demoForm = form(this.model);
}
