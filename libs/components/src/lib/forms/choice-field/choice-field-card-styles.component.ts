import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The card variant's panel chrome, as a styles-only component mounted the first time a choice field
 * is set to `variant="card"`.
 *
 * @internal
 */
@Component({
  selector: 'et-choice-field-card-styles',
  template: '',
  styleUrl: './choice-field-card-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ChoiceFieldCardStylesComponent {}
