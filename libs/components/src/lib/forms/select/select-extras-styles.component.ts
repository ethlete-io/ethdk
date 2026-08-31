import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The select panel's state and action rows (busy bar, loading/error/empty rows, load-more,
 * add-new), as a styles-only component mounted the first time a select can render one of them.
 *
 * @internal
 */
@Component({
  selector: 'et-select-extras-styles',
  template: '',
  styleUrl: './select-extras-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SelectExtrasStylesComponent {}
