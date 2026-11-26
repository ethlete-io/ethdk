import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The trigger chrome, divider baseline, underline geometry and hover/focus/active tints shared by
 * `et-tab-group` triggers and `et-nav-tab-link`. A tab bar host must map its own underline tokens
 * onto `--et-tab-bar-underline-size` / `--et-tab-bar-underline-radius`, or this sheet falls back to
 * the registered defaults.
 *
 * @internal
 */
@Component({
  selector: 'et-tab-bar-styles',
  template: '',
  styleUrl: './tab-bar-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TabBarStylesComponent {}

/** @internal */
export const mountTabBarStyles = () => injectStyleManager().mount(TabBarStylesComponent);
