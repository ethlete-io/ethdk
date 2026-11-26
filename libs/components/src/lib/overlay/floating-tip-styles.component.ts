import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The surface, content and pane styles shared by tooltip and toggletip, as a styles-only component.
 *
 * @internal
 */
@Component({
  selector: 'et-floating-tip-styles',
  template: '',
  styleUrl: './floating-tip-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FloatingTipStylesComponent {}

/** @internal */
export const mountFloatingTipStyles = () => injectStyleManager().mount(FloatingTipStylesComponent);
