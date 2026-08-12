import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The nav tab link's own look - padding, colors, focus ring and the underline's per-orientation
 * placement - as a styles-only component, so every link flavor ships the same rules instead of one
 * of them carrying them for the others.
 *
 * @internal
 */
@Component({
  selector: 'et-nav-tab-link-styles',
  template: '',
  styleUrl: './nav-tab-link-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class NavTabLinkStylesComponent {}

/**
 * Mounts the nav tab link styles. Call from anything rendering with the `et-nav-tab-link` class.
 *
 * @internal
 */
export const mountNavTabLinkStyles = () => injectStyleManager().mount(NavTabLinkStylesComponent);
