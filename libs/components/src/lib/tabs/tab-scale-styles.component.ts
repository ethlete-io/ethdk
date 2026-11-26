import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The tab metric scale - trigger padding, label size, underline thickness and the baseline alpha -
 * as a styles-only component, so tabs, nav tabs and the segmented button group's `tabs` variant read
 * one set of numbers instead of three copies of them.
 *
 * @internal
 */
@Component({
  selector: 'et-tab-scale-styles',
  template: '',
  styleUrl: './tab-scale-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TabScaleStylesComponent {}

/**
 * Mounts the tab metric scale. Call from anything that carries the `et-tab-scale` class, and put
 * `data-size` on the same element.
 *
 * @internal
 */
export const mountTabScaleStyles = () => injectStyleManager().mount(TabScaleStylesComponent);
