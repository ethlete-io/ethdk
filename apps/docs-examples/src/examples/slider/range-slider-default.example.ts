import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, RangeSliderValue, SLIDER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-range-slider-default-example',
  template: `
    <et-range-slider [formField]="priceForm.price">
      <et-label>Price range</et-label>
    </et-range-slider>

    <p>Form value: {{ priceForm.price().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SLIDER_IMPORTS, FormField, JsonPipe],
})
export class RangeSliderDefaultExampleComponent {
  private model = signal({ price: [20, 80] as RangeSliderValue });

  protected priceForm = form(this.model);
}
