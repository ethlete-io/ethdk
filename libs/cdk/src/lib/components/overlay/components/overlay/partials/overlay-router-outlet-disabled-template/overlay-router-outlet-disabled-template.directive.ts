import { Directive, InjectionToken } from '@angular/core';

export const OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN =
  new InjectionToken<OverlayRouterOutletDisabledTemplateDirective>('OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN');

@Directive({
  selector: 'ng-template[etOverlayRouterOutletDisabledTemplate]',
  standalone: true,
  providers: [
    {
      provide: OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN,
      useExisting: OverlayRouterOutletDisabledTemplateDirective,
    },
  ],
})
export class OverlayRouterOutletDisabledTemplateDirective {}
