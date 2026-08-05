import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Styles a native `<dl>` for term/detail rows - CSS grid auto-placement pairs each `<dt>`/`<dd>`
 * into its own row, so plain semantic markup is all a consumer writes; there is no term/detail
 * wrapper component to reach for.
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
  },
})
export class DescriptionListComponent {}
