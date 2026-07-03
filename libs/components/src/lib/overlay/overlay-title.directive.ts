import { Directive, ElementRef, OnInit, inject, input } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

let uniqueId = 0;

@Directive({
  selector: '[et-overlay-title], [etOverlayTitle]',
  exportAs: 'etOverlayTitle',
  host: {
    '[attr.id]': 'this.id()',
  },
})
export class OverlayTitleDirective implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public id = input(`et-overlay-title-${uniqueId++}`);
  private overlayManager = injectOverlayManager();
  private renderer = injectRenderer();

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });

    Promise.resolve().then(() => {
      const overlayRef = this.overlayRef;
      const hostElement = overlayRef?.elements?.hostElement;

      if (!overlayRef || !hostElement) return;

      if (!overlayRef.config.ariaLabel && !hostElement.getAttribute('aria-labelledby')) {
        this.renderer.setAttribute(hostElement, 'aria-labelledby', this.id());
      }
    });
  }
}
