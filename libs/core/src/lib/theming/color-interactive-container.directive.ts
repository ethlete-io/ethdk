import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

/**
 * Cascades hover/active-driven color DOWN to descendants explicitly marked with
 * `ColorInteractiveDirective` — this element does not color itself. Use it when a wrapper should
 * expand a nested control's hit/visual area (e.g. clicking a checkbox's label should light up the
 * checkbox itself), never to give a wrapper its own interactive coloring — that's
 * `ColorInteractiveDirective`.
 *
 * Does nothing unless at least one descendant carries `ColorInteractiveDirective` — check for
 * that before adding this. It was mistakenly added to a component with no such descendant once
 * already, where it did nothing but was confusing to read.
 */
@Directive({
  selector: '[etColorInteractiveContainer]',
  host: {
    class: 'et-color-interactive-container',
  },
})
export class ColorInteractiveContainerDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
