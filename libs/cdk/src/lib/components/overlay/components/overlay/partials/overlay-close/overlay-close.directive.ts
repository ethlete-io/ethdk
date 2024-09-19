import { Directive, ElementRef, HostBinding, HostListener, Input, OnInit, inject } from '@angular/core';
import { OverlayService } from '../../services';
import { OverlayRef, getClosestOverlay } from '../../utils';

@Directive({
  selector: '[et-overlay-close], [etOverlayClose]',
  exportAs: 'etOverlayClose',
  host: {
    '[attr.aria-label]': 'ariaLabel || null',
  },
  standalone: true,
})
export class OverlayCloseDirective implements OnInit {
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  @Input('aria-label')
  ariaLabel?: string;

  @Input()
  @HostBinding('attr.type')
  type: 'submit' | 'button' | 'reset' = 'button';

  @Input('et-overlay-close')
  closeResult: unknown;

  @Input('etOverlayClose')
  set _closeResult(value: unknown) {
    this.closeResult = value;
  }

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }
  }

  @HostListener('click', ['$event'])
  _onButtonClick(event: MouseEvent) {
    if (!this._overlayRef) {
      return;
    }

    this._overlayRef._closeOverlayVia(
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.closeResult,
    );
  }
}
