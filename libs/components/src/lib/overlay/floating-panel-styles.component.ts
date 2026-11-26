import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The enter/leave animation shared by every anchored floating panel (tooltip, toggletip, menu,
 * and - via the same mount call - any future panel with the same open/close choreography), as a
 * styles-only component mounted by whichever directive opens the panel.
 *
 * A consumer opts in by adding the `et-floating-panel` class to its overlay's `containerClass`
 * and setting `--et-floating-panel-enter-duration`, `--et-floating-panel-leave-duration` and
 * `--et-floating-panel-distance` on that same class, then calling `mountFloatingPanelStyles()`
 * once (e.g. from its directive's constructor).
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
