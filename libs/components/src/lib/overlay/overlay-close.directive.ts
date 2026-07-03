import { Directive, ElementRef, OnInit, inject, input } from '@angular/core';
import { applyHostListener } from '@ethlete/core';
import { getClosestOverlay, resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

@Directive({
  selector: '[et-overlay-close], [etOverlayClose]',
  exportAs: 'etOverlayClose',
  host: {
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.type]': 'type()',
  },
})
export class OverlayCloseDirective implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public ariaLabel = input<string>(undefined, { alias: 'aria-label' });
  public type = input<'submit' | 'button' | 'reset'>('button');

  public closeResult = input<unknown>(undefined, { alias: 'etOverlayClose' });
  public closeResultAlt = input<unknown>(undefined, { alias: 'et-overlay-close' });
  private overlayManager = injectOverlayManager();

  constructor() {
    applyHostListener('click', () => {
      const overlayRef = this.overlayRef ?? getClosestOverlay(this.elementRef, this.overlayManager.openOverlays());

      overlayRef?.close(this.closeResult() ?? this.closeResultAlt());
    });
  }

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }
}
