import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export const OVERLAY_FOOTER_TOKEN = new InjectionToken<OverlayFooterDirective>('OVERLAY_FOOTER_TOKEN');

@Directive({
  selector: '[etOverlayFooter], et-overlay-footer',
  providers: [
    {
      provide: OVERLAY_FOOTER_TOKEN,
      useExisting: OverlayFooterDirective,
    },
  ],
  host: {
    class: 'et-overlay-footer',
  },
})
export class OverlayFooterDirective implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }
}
