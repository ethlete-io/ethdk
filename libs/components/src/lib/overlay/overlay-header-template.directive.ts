import { Directive, ElementRef, InjectionToken, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export const OVERLAY_HEADER_TEMPLATE_TOKEN = new InjectionToken<OverlayHeaderTemplateDirective>(
  'OVERLAY_HEADER_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etOverlayHeaderTemplate]',
  providers: [
    {
      provide: OVERLAY_HEADER_TEMPLATE_TOKEN,
      useExisting: OverlayHeaderTemplateDirective,
    },
  ],
})
export class OverlayHeaderTemplateDirective implements OnInit, OnDestroy {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public template = inject<TemplateRef<unknown>>(TemplateRef);
  private overlayManager = injectOverlayManager();

  constructor() {
    this.overlayRef?.setHeaderTemplate(this.template);
  }

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });

    this.overlayRef.setHeaderTemplate(this.template);
  }

  public ngOnDestroy() {
    if (this.overlayRef?.headerTemplate() === this.template) {
      this.overlayRef.setHeaderTemplate(null);
    }
  }
}
