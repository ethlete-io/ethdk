import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { OverlayService } from '../../services';
import { OverlayRef, getClosestOverlay } from '../../utils';

export const OVERLAY_MAIN_TOKEN = new InjectionToken<OverlayMainDirective>('OVERLAY_MAIN_TOKEN');

@Directive({
  selector: '[etOverlayMain], et-overlay-main',
  standalone: true,
  providers: [
    {
      provide: OVERLAY_MAIN_TOKEN,
      useExisting: OverlayMainDirective,
    },
  ],
  host: {
    class: 'et-overlay-main',
  },
})
export class OverlayMainDirective implements OnInit {
  private _parent = inject(OVERLAY_MAIN_TOKEN, { optional: true, skipSelf: true });

  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  ngOnInit() {
    if (this._parent) {
      throw new Error('An overlay must not contain nested <et-overlay-main> elements or etOverlayMain directives.');
    }

    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays);

      if (!closestRef) {
        throw new Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }
  }
}
