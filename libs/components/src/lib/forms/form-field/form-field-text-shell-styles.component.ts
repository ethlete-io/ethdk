import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The text-field shell chrome (per-size tokens, label modes, hover/focus/error/disabled frame
 * states), as a styles-only component mounted by the controls that render inside that shell.
 *
 * Referenced only from those controls, so a form field that only ever holds a checkbox, switch or
 * slider never pulls the shell's CSS into the bundle.
 *
 * @internal
 */
@Component({
  selector: 'et-form-field-text-shell-styles',
  template: '',
  styleUrl: './form-field-text-shell-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FormFieldTextShellStylesComponent {}

/**
 * Mounts the text-field shell stylesheet. Call from the constructor of every control that renders
 * inside the shell (i.e. every control the form field reports `usesTextFieldShell()` for).
 *
 * @internal
 */
export const mountTextFieldShellStyles = () => injectStyleManager().mount(FormFieldTextShellStylesComponent);
