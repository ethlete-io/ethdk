import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, RATING_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-rating-default-example',
  template: `
    <et-rating [formField]="reviewForm.value">
      <et-label>Rating</et-label>
      <et-hint>Optional</et-hint>
    </et-rating>

    <p>Form value: {{ reviewForm.value().value() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RATING_IMPORTS, FormField],
})
export class RatingDefaultExampleComponent {
  private model = signal<{ value: number | null }>({ value: null });

  protected reviewForm = form(this.model);
}
