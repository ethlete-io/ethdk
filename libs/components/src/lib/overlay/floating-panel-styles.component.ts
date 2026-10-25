import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The enter/leave animation shared by every anchored floating panel (tooltip, toggletip, menu,
 * and - via the same mount call - any future panel with the same open/close choreography), as a
 * styles-only component mounted by whichever directive opens the panel.
 *
 * A consumer opts in by adding the `et-floating-panel` class to its overlay's `containerClass`
 * then calling `mountFloatingPanelStyles()` once (e.g. from its directive's constructor). The
 * panel fades opacity only: 140ms in, 100ms out.
 *
 * @internal
 */
@Component({
  selector: 'et-floating-panel-styles',
  template: '',
  styleUrl: './floating-panel-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FloatingPanelStylesComponent {}

/** @internal */
export const mountFloatingPanelStyles = () => injectStyleManager().mount(FloatingPanelStylesComponent);
