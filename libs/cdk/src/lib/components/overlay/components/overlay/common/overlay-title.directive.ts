import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';
import { getClosestOverlay } from '../get-closest-overlay';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';

let uniqueId = 0;

@Directive({
  selector: '[et-overlay-title], [etOverlayTitle]',
  exportAs: 'etOverlayTitle',
  host: {
    '[attr.id]': 'this.id()',
  },
})
export class OverlayTitleDirective implements OnInit {
  private overlayRef = inject(OverlayRef, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  readonly id = input(`et-overlay-title-${uniqueId++}`);

  ngOnInit() {
    if (!this.overlayRef) {
      const closestRef = getClosestOverlay(this.elementRef, this.overlayManager.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this.overlayRef = closestRef;
    }

    Promise.resolve().then(() => this.overlayRef?._containerInstance?._ariaLabelledByQueue?.push(this.id()));
  }
}
