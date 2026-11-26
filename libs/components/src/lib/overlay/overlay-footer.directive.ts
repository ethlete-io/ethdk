import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OVERLAY_MAIN_TOKEN } from './overlay-main.directive';
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
  private overlayMain = inject(OVERLAY_MAIN_TOKEN, { optional: true });

  public ngOnInit() {
    if (!this.overlayMain) {
      throw new RuntimeError(
        OVERLAY_ERROR_CODES.MISSING_OVERLAY_MAIN,
        '[OverlayFooterDirective] An overlay footer must be used inside an <et-overlay-main> element or a host with the etOverlayMain directive.',
      );
    }

    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }
}
