import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The divider baseline, underline geometry and hover/focus/active tints shared by `et-tab-group`
 * triggers and `et-nav-tab-link` - one set of rules instead of two near-identical copies.
 *
 * @internal
 */
@Component({
  selector: 'et-tab-underline-styles',
  template: '',
  styleUrl: './tab-underline-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TabUnderlineStylesComponent {}

/** @internal */
export const mountTabUnderlineStyles = () => injectStyleManager().mount(TabUnderlineStylesComponent);
