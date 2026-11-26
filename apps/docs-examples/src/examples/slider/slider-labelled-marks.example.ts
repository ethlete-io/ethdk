import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form, max } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SLIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-slider-labelled-marks-example',
  template: `
    <et-slider [formField]="qualityForm.quality" [marks]="QUALITY_MARKS" snapToMarks>
      <et-label>Quality</et-label>
      <et-hint>Values snap to the marks; the thumb announces the label</et-hint>
    </et-slider>

    <p>Form value: {{ qualityForm.quality().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SLIDER_IMPORTS, FormField, JsonPipe],
})
export class SliderLabelledMarksExampleComponent {
  protected readonly QUALITY_MARKS = [
    { value: 0, label: 'Low' },
    { value: 1, label: 'Medium' },
    { value: 2, label: 'High' },
  ];

  private model = signal({ quality: 1 });

  protected qualityForm = form(this.model, (path) => {
    max(path.quality, 2);
  });
}
