import { Directive } from '@angular/core';
import { FORM_FIELD_TOKEN } from '../headless/form-field.tokens';

/**
 * Hides the surrounding form field from a nested control composition, so a control assembled out of
 * another control - the phone input's country `[etSelect]`, say - does not register itself as the
 * field's control.
 *
 * Goes on the element the nested composition starts at, never on the outer control: that control's
 * own template still has to reach the field to hand it a `[etControlSuffix]`.
 */
@Directive({
  selector: '[etFormFieldBarrier]',
  providers: [{ provide: FORM_FIELD_TOKEN, useValue: null }],
})
export class FormFieldBarrierDirective {}
