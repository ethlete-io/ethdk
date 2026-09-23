import { booleanAttribute, Directive, input, signal } from '@angular/core';
import { ACCESSIBLE_NAME_INPUTS } from './accessible-name-control.directive';
import { FieldWarningResult } from './field-warnings';
import { TextShellControlDirective } from './text-shell-control.directive';

/**
 * The base's inputs, for a wrapper component's `hostDirectives` list. Spread it instead of copying
 * the names - a dropped entry makes that binding an NG0303 on the wrapper.
 */
export const TEXT_FIELD_CONTROL_INPUTS = [
  'touched',
  'mixed',
  'mixedLabel',
  'disabled',
  'readonly',
  'hidden',
  'invalid',
  'errors',
  'warnings',
  'required',
  'name',
  'maxLength',
  'pending',
  ...ACCESSIBLE_NAME_INPUTS,
] as const;

/**
 * Shared wiring for the native-input-backed controls that render inside the text-field shell
 * (`et-input`, `et-number-input`, `et-password-input`, `et-color-input`, `et-textarea`).
 *
 * Subclasses add their own `value` model, `controlType`, `hasValue`, and any control-specific
 * surface (placeholder, native element wiring, etc.). Must be extended by an `@Directive` - Angular
 * only surfaces inherited inputs/outputs from a decorated base.
 */
@Directive()
export abstract class TextFieldControlDirective extends TextShellControlDirective {
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false, { transform: booleanAttribute });

  /**
   * Non-blocking advisories to show under the field, for a control that is not bound to a
   * signal-forms field (which would carry them through `warn()` rules instead). A bare string is
   * one advisory; `null` is none. They never reach validity.
   */
  public warnings = input<FieldWarningResult>(null);

  /**
   * The bound field's `maxLength()` limit, bound automatically by signal forms because this input
   * exists - so `<et-counter />` needs no `[max]` for a schema-validated field.
   *
   * Deliberately **not** forwarded to the native `maxlength` attribute. Set `maxlength` yourself on
   * the control if you want the browser to clamp instead.
   */
  public maxLength = input<number | undefined>(undefined);

  /**
   * True while an async validator is in flight for the bound field - bound automatically by signal
   * forms because this input exists.
   */
  public pending = input(false, { transform: booleanAttribute });

  /** @internal The element `focus()` targets - the native control by default. */
  public focusTarget = signal<HTMLElement | null>(null);

  protected focusControl(options?: FocusOptions) {
    this.focusTarget()?.focus(options);
  }
}
