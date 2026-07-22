import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OVERLAY_MAIN_TOKEN } from './overlay-main.directive';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export const OVERLAY_HEADER_TOKEN = new InjectionToken<OverlayHeaderDirective>('OVERLAY_HEADER_TOKEN');

@Directive({
  selector: '[etOverlayHeader], et-overlay-header',
  providers: [
    {
      provide: OVERLAY_HEADER_TOKEN,
      useExisting: OverlayHeaderDirective,
    },
  ],
  host: {
    class: 'et-overlay-header',
  },
})
export class OverlayHeaderDirective implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();
  private overlayMain = inject(OVERLAY_MAIN_TOKEN, { optional: true });

  public ngOnInit() {
    if (!this.overlayMain) {
      throw new RuntimeError(
        OVERLAY_ERROR_CODES.MISSING_OVERLAY_MAIN,
        '[OverlayHeaderDirective] An overlay header must be used inside an <et-overlay-main> element or a host with the etOverlayMain directive.',
      );
    }

    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }
}
