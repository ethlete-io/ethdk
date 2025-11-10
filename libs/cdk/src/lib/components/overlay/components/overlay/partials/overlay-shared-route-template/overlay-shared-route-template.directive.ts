import { Directive, InjectionToken } from '@angular/core';

export const OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN = new InjectionToken<OverlaySharedRouteTemplateDirective>(
  'OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etOverlaySharedRouteTemplate]',

  providers: [
    {
      provide: OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN,
      useExisting: OverlaySharedRouteTemplateDirective,
    },
  ],
})
export class OverlaySharedRouteTemplateDirective {}
