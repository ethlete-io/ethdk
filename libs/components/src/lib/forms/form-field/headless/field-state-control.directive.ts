import { booleanAttribute, Directive, input } from '@angular/core';
import { AccessibleNameControlDirective } from './accessible-name-control.directive';
import { FieldWarningResult } from './field-warnings';

/** The base's own inputs, for a wrapper component's `hostDirectives` list. */
export const FIELD_STATE_INPUTS = ['hidden', 'warnings'] as const;

/**
 * The `hidden` and `warnings` inputs for a form-field control that does not render in the text
 * shell. Must be extended by an `@Directive` - Angular only surfaces inherited inputs from a
 * decorated base.
 */
@Directive()
export abstract class FieldStateControlDirective extends AccessibleNameControlDirective {
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false, { transform: booleanAttribute });

  /**
   * Non-blocking advisories to show under the field, for a control that is not bound to a
   * signal-forms field (which would carry them through `warn()` rules instead). A bare string is
   * one advisory; `null` is none. They never reach validity.
   */
  public warnings = input<FieldWarningResult>(null);
}
