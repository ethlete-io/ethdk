import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SLIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-slider-marks-example',
  template: `
    <et-slider [formField]="volumeForm.volume" [step]="10" [marks]="TICKS">
      <et-label>Volume</et-label>
      <et-hint>A tick at every step</et-hint>
    </et-slider>

    <p>Form value: {{ volumeForm.volume().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SLIDER_IMPORTS, FormField, JsonPipe],
})
export class SliderMarksExampleComponent {
  protected readonly TICKS = true;

  private model = signal({ volume: 40 });

  protected volumeForm = form(this.model);
}
