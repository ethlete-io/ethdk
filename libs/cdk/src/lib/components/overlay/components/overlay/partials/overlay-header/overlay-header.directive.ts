import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { injectOverlayManager } from '../../overlay-manager';
import { OverlayRef, getClosestOverlay } from '../../utils';

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
