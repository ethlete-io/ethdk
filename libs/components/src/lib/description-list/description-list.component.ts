import { Component, input, ViewEncapsulation } from '@angular/core';

export const DESCRIPTION_LIST_VARIANTS = {
  INLINE: 'inline',
  STACKED: 'stacked',
} as const;

export type DescriptionListVariant = (typeof DESCRIPTION_LIST_VARIANTS)[keyof typeof DESCRIPTION_LIST_VARIANTS];

/**
 * Styles a native `<dl>` for term/detail rows - CSS grid auto-placement pairs each `<dt>`/`<dd>`
 * into its own row, so plain semantic markup is all a consumer writes; there is no term/detail
 * wrapper component to reach for.
 *
 * `variant="inline"` (the default) puts the term beside its detail in two columns;
 * `variant="stacked"` puts it above, in one column.
 *
 * @example
 * <dl et-description-list>
 *   <dt>Name</dt>
 *   <dd>Jane Doe</dd>
 *   <dt>Email</dt>
 *   <dd>jane&#64;example.com</dd>
 * </dl>
 */
@Component({
  selector: 'dl[et-description-list]',
  template: '<ng-content />',
  styleUrl: './description-list.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-description-list',
    '[attr.data-variant]': 'variant()',
  },
})
export class DescriptionListComponent {
  public variant = input<DescriptionListVariant>(DESCRIPTION_LIST_VARIANTS.INLINE);
}
