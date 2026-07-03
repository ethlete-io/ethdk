import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { OVERLAY_ROUTER_OUTLET_TOKEN } from './overlay-router-outlet.component';

@Component({
  selector: 'et-overlay-shared-route-template-outlet',
  template: `
    @if (routerOutlet.sharedRouteTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-overlay-shared-route-template-outlet-host',
  },
  styles: `
    .et-overlay-shared-route-template-outlet-host {
      display: contents;
    }
  `,
})
export class OverlaySharedRouteTemplateOutletComponent {
  protected routerOutlet = inject(OVERLAY_ROUTER_OUTLET_TOKEN);
}
