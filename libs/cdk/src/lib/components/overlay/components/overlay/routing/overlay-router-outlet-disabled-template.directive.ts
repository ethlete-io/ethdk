import { Directive, InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN =
  new InjectionToken<OverlayRouterOutletDisabledTemplateDirective>('OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'ng-template[etOverlayRouterOutletDisabledTemplate]',
  providers: [
    {
      provide: OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN,
      useExisting: OverlayRouterOutletDisabledTemplateDirective,
    },
  ],
})
export class OverlayRouterOutletDisabledTemplateDirective {}
