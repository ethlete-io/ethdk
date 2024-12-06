import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { OVERLAY_ROUTER_OUTLET_TOKEN } from '../overlay-router-outlet';

@Component({
  selector: 'et-overlay-shared-route-template-outlet',
  template: `
    @if (routerOutlet.sharedRouteTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-shared-route-template-outlet-host',
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
