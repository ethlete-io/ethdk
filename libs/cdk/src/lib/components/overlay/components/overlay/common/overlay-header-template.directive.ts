import { Directive, ElementRef, InjectionToken, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';
import { getClosestOverlay } from '../get-closest-overlay';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OVERLAY_HEADER_TEMPLATE_TOKEN = new InjectionToken<OverlayHeaderTemplateDirective>(
  'OVERLAY_HEADER_TEMPLATE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  template = inject(TemplateRef);

  constructor() {
    this._overlayRef?._setCurrentHeaderTemplate(this.template);
  }

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this.overlayManager.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
      this._overlayRef._setCurrentHeaderTemplate(this.template);
    }
  }

  ngOnDestroy(): void {
    if (this._overlayRef?.headerTemplate() === this.template) {
      this._overlayRef?._setCurrentHeaderTemplate(null);
    }
  }
}
