import { Directive, ElementRef, InjectionToken, OnInit, booleanAttribute, inject, input } from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
import { getClosestOverlay } from '../get-closest-overlay';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';

export const OVERLAY_MAIN_TOKEN = new InjectionToken<OverlayMainDirective>('OVERLAY_MAIN_TOKEN');

@Directive({
  selector: '[etOverlayMain], et-overlay-main',
  providers: [
    {
      provide: OVERLAY_MAIN_TOKEN,
      useExisting: OverlayMainDirective,
    },
  ],
})
export class OverlayMainDirective implements OnInit {
  private _parent = inject(OVERLAY_MAIN_TOKEN, { optional: true, skipSelf: true });

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  _overlayRef = inject(OverlayRef, { optional: true });

  enabled = input(true, { alias: 'etOverlayMain', transform: booleanAttribute });

  hostClassBindings = signalHostClasses({
    'et-overlay-main': this.enabled,
  });

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this.elementRef, this.overlayManager.openOverlays());

      if (!closestRef) {
        throw new Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }

    if (this._parent) {
      if (this._overlayRef.id === this._parent._overlayRef?.id) {
        throw new Error('An overlay must not contain nested <et-overlay-main> elements or etOverlayMain directives.');
      }
    }
  }
}
