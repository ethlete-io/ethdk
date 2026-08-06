import { Directive, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { FORM_FIELD_TOKEN } from '../headless/form-field.tokens';
import { registerSingleton } from '../headless/register-singleton';

/**
 * Hands a control's own in-field affordances - a clear button, a picker trigger, a reveal toggle -
 * to the form field's suffix slot, so they share one stack with `[etInputSuffix]` and the busy
 * spinner instead of a look-alike row of their own. Applied by the controls, not by consumers:
 *
 * ```html
 * <ng-template etControlSuffix>
 *   <button class="et-input-clear" type="button">…</button>
 * </ng-template>
 * ```
 *
 * With no form field to hand them to, the template renders where it stands.
 */
@Directive({ selector: 'ng-template[etControlSuffix]' })
export class ControlSuffixDirective {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });

  public templateRef = inject<TemplateRef<void>>(TemplateRef);

  constructor() {
    if (this.formField) {
      registerSingleton(this.formField.registeredControlSuffix, this);
    } else {
      inject(ViewContainerRef).createEmbeddedView(this.templateRef);
    }
  }
}
