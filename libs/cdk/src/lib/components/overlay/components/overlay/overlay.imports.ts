import { Dialog } from '@angular/cdk/dialog';
import { OverlayBackOrCloseDirective } from './partials/overlay-back-or-close';
import { OverlayBodyComponent } from './partials/overlay-body';
import { OverlayCloseDirective } from './partials/overlay-close';
import { OverlayFooterDirective } from './partials/overlay-footer';
import { OverlayHeaderDirective } from './partials/overlay-header';
import { OverlayHeaderTemplateDirective } from './partials/overlay-header-template';
import { OverlayMainDirective } from './partials/overlay-main';
import { OverlayRouteHeaderTemplateOutletComponent } from './partials/overlay-route-header-template-outlet';
import { OverlayRouterLinkDirective } from './partials/overlay-router-link';
import { OverlayRouterOutletComponent } from './partials/overlay-router-outlet';
import { OverlayRouterOutletDisabledTemplateDirective } from './partials/overlay-router-outlet-disabled-template';
import { OverlaySharedRouteTemplateDirective } from './partials/overlay-shared-route-template';
import { OverlaySharedRouteTemplateOutletComponent } from './partials/overlay-shared-route-template-outlet';
import { OverlaySidebarComponent } from './partials/overlay-sidebar';
import { OverlayTitleDirective } from './partials/overlay-title';

export const OverlayImports = [
  OverlayCloseDirective,
  OverlayTitleDirective,
  OverlayHeaderDirective,
  OverlayBodyComponent,
  OverlayFooterDirective,
  OverlayMainDirective,
] as const;

export const OverlayWithRoutingImports = [
  ...OverlayImports,
  OverlayHeaderTemplateDirective,
  OverlayRouterOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayBackOrCloseDirective,
  OverlaySharedRouteTemplateOutletComponent,
  OverlaySharedRouteTemplateDirective,
  OverlayRouterOutletDisabledTemplateDirective,
] as const;

export const OverlayWithSidebarImports = [...OverlayWithRoutingImports, OverlaySidebarComponent] as const;

export const provideOverlay = () => {
  return [Dialog];
};
