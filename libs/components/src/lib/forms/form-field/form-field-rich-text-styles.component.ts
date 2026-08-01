import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The form field's rich-text frame overrides, as a styles-only component mounted by the rich text
 * editor (see `FormFieldTextShellStylesComponent` for the pattern).
 *
 * @internal
 */
@Component({
  selector: 'et-form-field-rich-text-styles',
  template: '',
  styleUrl: './form-field-rich-text-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FormFieldRichTextStylesComponent {}
