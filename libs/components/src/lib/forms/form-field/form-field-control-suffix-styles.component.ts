import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The in-field affordances a text-shell control hands to the field's suffix slot - the clear button
 * and the picker trigger - as a styles-only component (see `FormFieldTextShellStylesComponent` for
 * the pattern). Referenced only from the controls that render them.
 *
 * @internal
 */
@Component({
  selector: 'et-form-field-control-suffix-styles',
  template: '',
  styleUrl: './form-field-control-suffix-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FormFieldControlSuffixStylesComponent {}

/**
 * Mounts the stylesheet for `.et-input-clear` / `.et-input-picker-trigger`. Call from the
 * constructor of every control that renders either.
 *
 * @internal
 */
export const mountControlSuffixStyles = () => injectStyleManager().mount(FormFieldControlSuffixStylesComponent);
