import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from './style-manager';

/**
 * Declares the `et-visually-hidden` class as a styles-only component: content that stays in the
 * accessibility tree but is clipped out of the layout. Mount it from any component whose template
 * uses the class.
 */
@Component({
  selector: 'et-visually-hidden-styles',
  template: '',
  styleUrl: './visually-hidden-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class VisuallyHiddenStylesComponent {}

/** Mounts {@link VisuallyHiddenStylesComponent}. Call from an injection context. */
export const mountVisuallyHidden = () => injectStyleManager().mount(VisuallyHiddenStylesComponent);
