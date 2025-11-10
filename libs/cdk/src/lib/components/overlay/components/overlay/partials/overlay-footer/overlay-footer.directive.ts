import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { OverlayService } from '../../services';
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
  private readonly _overlayService = inject(OverlayService);

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }
  }
}
