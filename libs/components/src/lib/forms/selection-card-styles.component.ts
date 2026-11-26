import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The card variant's panel chrome, shared by `et-radio`, `et-checkbox-option` and `et-choice-field`
 * and mounted the first time any of them is set to `variant="card"`. Applies to the element carrying
 * `.et-selection-card`.
 *
 * @internal
 */
@Component({
  selector: 'et-selection-card-styles',
  template: '',
  styleUrl: './selection-card-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SelectionCardStylesComponent {}
