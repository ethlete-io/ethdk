import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { OverlayDirective } from './overlay.directive';

@Directive({
  selector: '[etOverlayAnchor]',
  exportAs: 'etOverlayAnchor',
})
export class OverlayAnchorDirective {
  private overlay = inject(OverlayDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.overlay?.registeredAnchor.set(this);

    this.destroyRef.onDestroy(() => {
      this.overlay?.unregisterAnchor(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.overlay) {
          throw new RuntimeError(
            OVERLAY_ERROR_CODES.ANCHOR_OUTSIDE_OVERLAY,
            '[OverlayAnchorDirective] etOverlayAnchor must be placed inside an [etOverlay] element.',
          );
        }
      });
    }
  }
}
