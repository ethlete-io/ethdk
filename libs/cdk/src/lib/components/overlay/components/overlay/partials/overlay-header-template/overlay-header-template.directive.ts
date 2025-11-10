import { Directive, ElementRef, InjectionToken, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';
import { OverlayService } from '../../services';
import { OverlayRef, getClosestOverlay } from '../../utils';

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
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  template = inject(TemplateRef);

  constructor() {
    this._overlayRef?._setCurrentHeaderTemplate(this.template);
  }

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

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
