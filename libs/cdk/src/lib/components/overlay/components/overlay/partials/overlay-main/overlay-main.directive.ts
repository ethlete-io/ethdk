import { Directive, ElementRef, InjectionToken, OnInit, booleanAttribute, inject, input } from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
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
})
export class OverlayMainDirective implements OnInit {
  private _parent = inject(OVERLAY_MAIN_TOKEN, { optional: true, skipSelf: true });

  _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  enabled = input(true, { alias: 'etOverlayMain', transform: booleanAttribute });

  hostClassBindings = signalHostClasses({
    'et-overlay-main': this.enabled,
  });

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

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
