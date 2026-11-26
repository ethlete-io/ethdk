import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The option row shared by `et-select-option`, `et-select-virtual-option` and `et-select-all-option`,
 * as a styles-only component each of them mounts.
 *
 * @internal
 */
@Component({
  selector: 'et-select-option-styles',
  template: '',
  styleUrl: './select-option-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SelectOptionStylesComponent {}

/** @internal */
export const mountSelectOptionStyles = () => injectStyleManager().mount(SelectOptionStylesComponent);
