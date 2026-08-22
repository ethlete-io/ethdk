import { computed, Directive, inject, input } from '@angular/core';
import { FORM_FIELD_TOKEN } from './form-field.tokens';

/**
 * The naming inputs, for a wrapper component's `hostDirectives` list. Spread it instead of copying
 * the names - a dropped entry makes that binding an NG0303 on the wrapper and leaves the control
 * unnamed.
 */
export const ACCESSIBLE_NAME_INPUTS = ['aria-label', 'aria-labelledby'] as const;

/**
 * The author-supplied accessible name every form-field control accepts: `aria-label` /
 * `aria-labelledby` written on the control itself, for a control named by something outside its
 * field - a shared caption over a filter row, a dense table cell, a page-size select. Without them
 * the attribute lands on the role-less wrapper element (where no assistive tech reads it) and the
 * field's dev-time labelling guard (ET2201) fires on a control that *is* labelled.
 *
 * A control extending this still has to render the name: bind `aria-label` onto whatever element
 * carries its role (the native input, the trigger, the editable), and `aria-labelledby` off
 * {@link labelId}. Must be extended by an `@Directive` - Angular only surfaces inherited inputs
 * from a decorated base.
 */
@Directive()
export abstract class AccessibleNameControlDirective {
  private namingFormField = inject(FORM_FIELD_TOKEN, { optional: true });

  /**
   * Author-supplied accessible name, forwarded onto the element that carries the control's role.
   * Use this (or an `<et-label>`) when the field has no visible label - a placeholder is not an
   * accessible name.
   */
  public ariaLabel = input<string | null>(null, { alias: 'aria-label' });

  /**
   * Author-supplied `aria-labelledby`, forwarded onto the element that carries the control's role.
   * Takes precedence over the id of a projected `<et-label>`.
   */
  public ariaLabelledby = input<string | null>(null, { alias: 'aria-labelledby' });

  /**
   * The `aria-labelledby` the control should render: a consumer-supplied value wins, otherwise the
   * id of a projected `<et-label>`.
   */
  public labelId = computed(
    () => this.ariaLabelledby()?.trim() || (this.namingFormField?.registeredLabel()?.id() ?? null),
  );

  public hasCustomAccessibleName = computed(() => !!this.ariaLabel()?.trim() || !!this.ariaLabelledby()?.trim());
}
