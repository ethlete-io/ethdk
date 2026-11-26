import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { OVERLAY_ROUTER_OUTLET_TOKEN } from './overlay-router-outlet.component';

@Component({
  selector: 'et-overlay-shared-route-template-outlet',
  template: `
    @if (routerOutlet.sharedRouteTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl" />
    }
  `,
  styleUrl: './overlay-shared-route-template-outlet.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-overlay-shared-route-template-outlet-host',
    // Forces a component ID distinct from the identical @ethlete/cdk twin (NG0912).
    'data-et-components': '',
  },
})
export class OverlaySharedRouteTemplateOutletComponent {
  protected routerOutlet = inject(OVERLAY_ROUTER_OUTLET_TOKEN);
}
