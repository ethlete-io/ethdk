import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { resolveClosestOverlay } from './get-closest-overlay';
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

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }
}
