import { booleanAttribute, Directive, input } from '@angular/core';
import { createCanAnimateSignal } from '@ethlete/core';

/**
 * Marks an element as a region that is either open or collapsed. Collapsed content is `inert`;
 * the host carries `data-open` while open and `data-can-animate` from one frame after the first
 * render, so a region that starts open does not animate in. It adds no styles - the default
 * `et-collapse` animates the height off these attributes.
 */
@Directive({
  selector: '[etCollapse]',
  exportAs: 'etCollapse',
  host: {
    '[attr.data-open]': 'open() ? "" : null',
    '[attr.inert]': 'open() ? null : ""',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class CollapseDirective {
  public open = input(false, { transform: booleanAttribute });

  /** Set one frame after the first render. Gate transitions on `[data-can-animate]`. */
  public canAnimate = createCanAnimateSignal();
}
