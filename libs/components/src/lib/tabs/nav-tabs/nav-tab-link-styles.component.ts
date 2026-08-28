import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { mountTabUnderlineStyles } from '../tab-underline-styles.component';

/** @internal */
@Component({
  selector: 'et-nav-tab-link-styles',
  template: '',
  styleUrl: './nav-tab-link-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class NavTabLinkStylesComponent {}

/** @internal */
export const mountNavTabLinkStyles = () => {
  mountTabUnderlineStyles();

  return injectStyleManager().mount(NavTabLinkStylesComponent);
};
