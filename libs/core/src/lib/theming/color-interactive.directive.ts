import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

/**
 * Makes an element react to ITS OWN `:hover`/`:active`/`:focus-visible`/`[disabled]` by tinting
 * `--et-theme-color-primary-*`/`-on-primary-*`/`-ink-*` with the current color theme. Use this on
 * a single, self-contained interactive element — a button, a checkbox, a segmented button.
 *
 * Do NOT apply this to a wrapper that also contains OTHER, independently-interactive elements
 * (e.g. a toolbar with its own buttons, or a form-field's control slot). These are ordinary
 * inheriting CSS custom properties, so a descendant reading them for its own cosmetics (a caret
 * color, a link color) gets swept along whenever ANYTHING inside the wrapper is hovered or
 * clicked — not just when the wrapper itself is the thing being interacted with. That exact bug
 * shipped once already; see ColorInteractiveContainerDirective/ColorInteractiveHasFocusDirective
 * for the shapes that avoid it.
 */
@Directive({
  selector: '[etColorInteractive]',
  host: {
    class: 'et-color-interactive',
  },
})
export class ColorInteractiveDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
