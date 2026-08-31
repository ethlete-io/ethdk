import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The header/body/footer grid chrome for an overlay's structured content, as a styles-only
 * component mounted by `OverlayMainDirective`.
 *
 * `OverlayHeaderDirective`, `OverlayBodyComponent` and `OverlayFooterDirective` all require an
 * `OverlayMainDirective` ancestor, so mounting from its constructor guarantees this sheet is in
 * the document before any of them can render. Referenced only through `OVERLAY_CONTENT_IMPORTS`,
 * so an overlay with fully custom content does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-main-styles',
  template: '',
  styleUrl: './overlay-main-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class OverlayMainStylesComponent {}

/** @internal */
export const mountOverlayMainStyles = () => injectStyleManager().mount(OverlayMainStylesComponent);
