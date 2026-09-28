import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The form field's textarea frame overrides, as a styles-only component the form field mounts once
 * a textarea registers.
 *
 * @internal
 */
@Component({
  selector: 'et-form-field-textarea-styles',
  template: '',
  styleUrl: './form-field-textarea-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FormFieldTextareaStylesComponent {}
