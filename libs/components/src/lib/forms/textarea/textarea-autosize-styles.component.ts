import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Native autosizing for the textarea, as a styles-only component mounted by
 * `TextareaDirective` (see `FormFieldTextareaStylesComponent` for the pattern).
 *
 * @internal
 */
@Component({
  selector: 'et-textarea-autosize-styles',
  template: '',
  styleUrl: './textarea-autosize-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TextareaAutosizeStylesComponent {}
