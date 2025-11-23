import { Directive, ElementRef, HostBinding, inject, input, OnInit } from '@angular/core';
import { injectOverlayManager } from '../../overlay-manager';
import { getClosestOverlay, OverlayRef } from '../../utils';

let uniqueId = 0;

@Directive({
  selector: '[et-overlay-title], [etOverlayTitle]',
  exportAs: 'etOverlayTitle',
})
export class OverlayTitleDirective implements OnInit {
  private overlayRef = inject(OverlayRef, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  @HostBinding('attr.id')
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
