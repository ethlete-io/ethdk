import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/** @internal */
@Component({
  selector: 'et-nav-tab-link-styles',
  template: '',
  styleUrl: './nav-tab-link-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class NavTabLinkStylesComponent {}

/** @internal */
export const mountNavTabLinkStyles = () => injectStyleManager().mount(NavTabLinkStylesComponent);
