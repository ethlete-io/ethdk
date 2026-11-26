import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { mountTabBarStyles } from '../tab-bar-styles.component';

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
  mountTabBarStyles();

  return injectStyleManager().mount(NavTabLinkStylesComponent);
};
