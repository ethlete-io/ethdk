import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Styles-only component mounted by `FloatingActionDirective`; also declares the domain's public tokens.
 *
 * @internal
 */
@Component({
  selector: 'et-floating-action-styles',
  template: '',
  styleUrl: './floating-action-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FloatingActionStylesComponent {}
