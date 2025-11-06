import { Directive, ElementRef, HostBinding, inject, Input, OnInit } from '@angular/core';
import { OverlayService } from '../../services';
import { getClosestOverlay, OverlayRef } from '../../utils';

let uniqueId = 0;

@Directive({
  selector: '[et-overlay-title], [etOverlayTitle]',
  exportAs: 'etOverlayTitle',
  standalone: true,
})
export class OverlayTitleDirective implements OnInit {
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  @Input()
  @HostBinding('attr.id')
  id = `et-overlay-title-${uniqueId++}`;

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }

    Promise.resolve().then(() => this._overlayRef?._containerInstance?._ariaLabelledByQueue?.push(this.id));
  }
}
