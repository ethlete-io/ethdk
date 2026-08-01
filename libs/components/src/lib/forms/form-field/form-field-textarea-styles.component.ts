import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The form field's textarea frame overrides, as a styles-only component mounted by the textarea
 * (see `FormFieldTextShellStylesComponent` for the pattern).
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
