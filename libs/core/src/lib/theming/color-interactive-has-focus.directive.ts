import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

/**
 * Tints `--et-theme-color-primary-*` etc. only when a descendant genuinely has `:focus-visible`
 * (`:has(:focus-visible)`) — never on mouse `:hover`/`:active`. Use this for a wrapper (like a
 * form field's frame) that should show the theme color while its control is focused, but must
 * NOT react to incidental mouse interaction with unrelated nested widgets (a toolbar button, a
 * rendered link) that happen to live inside the same wrapper.
 *
 * Deliberately does NOT also carry `ColorInteractiveDirective`'s `et-color-interactive` class:
 * that class's plain `:hover`/`:active` rules locally override the same (inheriting)
 * `--et-theme-color-primary-rgb`, so anything bubbling up from ANYWHERE in the subtree would
 * leak the transient hover/press color into every descendant reading it for unrelated cosmetics —
 * exactly the bug this directive's only consumer (form-field) shipped once, before the two
 * behaviors were split apart. If you need the plain hover/active reaction too, add
 * `ColorInteractiveDirective` explicitly and make sure you actually want both.
 */
@Directive({
  selector: '[etColorInteractiveHasFocus]',
  host: {
    class: 'et-color-interactive--has-focus',
  },
})
export class ColorInteractiveHasFocusDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
