import { Directive, ElementRef, HostBinding, HostListener, Input, OnInit, inject, input } from '@angular/core';
import { setInputSignal } from '@ethlete/core';
import { OverlayService } from '../../services';
import { OverlayRef, getClosestOverlay } from '../../utils';

@Directive({
  selector: '[et-overlay-close], [etOverlayClose]',
  exportAs: 'etOverlayClose',
  host: {
    '[attr.aria-label]': 'ariaLabel() || null',
  },
})
export class OverlayCloseDirective implements OnInit {
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  readonly ariaLabel = input<string>(undefined, { alias: 'aria-label' });

  @HostBinding('attr.type')
  readonly type = input<'submit' | 'button' | 'reset'>('button');

  readonly closeResult = input<unknown>(undefined, { alias: 'et-overlay-close' });

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input('etOverlayClose')
  set _closeResult(value: unknown) {
    setInputSignal(this.closeResult, value);
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
      this.closeResult(),
    );
  }
}
