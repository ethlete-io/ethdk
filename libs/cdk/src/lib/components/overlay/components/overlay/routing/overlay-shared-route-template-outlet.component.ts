import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { OVERLAY_ROUTER_OUTLET_TOKEN } from './overlay-router-outlet.component';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-overlay-shared-route-template-outlet',
  template: `
    @if (routerOutlet.sharedRouteTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-shared-route-template-outlet-host et-legacy',
  },
  imports: [NgTemplateOutlet],
  styles: `
    .et-overlay-shared-route-template-outlet-host {
      display: contents;
    }
  `,
})
export class OverlaySharedRouteTemplateOutletComponent {
  routerOutlet = inject(OVERLAY_ROUTER_OUTLET_TOKEN);
}
