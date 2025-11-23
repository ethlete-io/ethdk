import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { injectOverlayManager } from '../../overlay-manager';
import { OverlayRef, getClosestOverlay } from '../../utils';

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
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this.overlayManager.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }
  }
}
