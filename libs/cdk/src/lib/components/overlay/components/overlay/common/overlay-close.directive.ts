import { Directive, ElementRef, OnInit, inject, input } from '@angular/core';
import { applyHostListener } from '@ethlete/core';
import { getClosestOverlay } from '../get-closest-overlay';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';

@Directive({
  selector: '[et-overlay-close], [etOverlayClose]',
  exportAs: 'etOverlayClose',
  host: {
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.type]': 'type() ',
  },
})
export class OverlayCloseDirective implements OnInit {
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  readonly ariaLabel = input<string>(undefined, { alias: 'aria-label' });
  readonly type = input<'submit' | 'button' | 'reset'>('button');

  closeResult = input<unknown>(undefined, { alias: 'etOverlayClose' });
  closeResultAlt = input<unknown>(undefined, { alias: 'et-overlay-close' });

  constructor() {
    applyHostListener('click', (event) => {
      if (!this._overlayRef) return;

      this._overlayRef._closeOverlayVia(
        event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
        this.closeResult() ?? this.closeResultAlt(),
      );
    });
  }

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
