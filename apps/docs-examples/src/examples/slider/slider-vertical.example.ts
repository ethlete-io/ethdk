import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SLIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-slider-vertical-example',
  template: `
    <et-slider [formField]="volumeForm.volume" [style.--et-slider-vertical-size.px]="220" orientation="vertical">
      <et-label>Volume</et-label>
      <ng-template etSliderThumbLabel let-value>{{ value }}</ng-template>
    </et-slider>

    <p>Form value: {{ volumeForm.volume().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SLIDER_IMPORTS, FormField, JsonPipe],
})
export class SliderVerticalExampleComponent {
  private model = signal({ volume: 40 });

  protected volumeForm = form(this.model);
}
