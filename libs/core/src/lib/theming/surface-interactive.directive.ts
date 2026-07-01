import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { SurfaceInteractiveStylesComponent } from './surface-interactive-styles.component';

/**
 * Same shape as `ColorInteractiveDirective` — reacts to its own `:hover`/`:focus-visible`/
 * `:active`/`[disabled]` — but drives `--et-surface-interaction-*`, a neutral/muted tint, instead
 * of the ambient color theme. Use it for chrome-level interaction feedback that shouldn't borrow
 * the page's brand color (a tab trigger's hover state, a toggle button that should look neutral
 * until it's actually active — see `ButtonDirective`'s `mutedUntilPressed`).
 *
 * Has no container/exclude/has-focus variants: it has no descendant-cascading CSS at all, so
 * applying it to a wrapper with independently-interactive children is safe by construction —
 * unlike `ColorInteractiveDirective`, there's no bubbling-leak failure mode to worry about here.
 */
@Directive({
  selector: '[etSurfaceInteractive]',
  host: {
    class: 'et-surface-interactive',
  },
})
export class SurfaceInteractiveDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(SurfaceInteractiveStylesComponent);
  }
}
