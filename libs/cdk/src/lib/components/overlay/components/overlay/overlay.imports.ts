import { Dialog } from '@angular/cdk/dialog';
import { provideEnvironmentInitializer } from '@angular/core';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayHeaderTemplateDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from './common';
import {
  OverlayBackOrCloseDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  OverlayRouterOutletDisabledTemplateDirective,
  OverlaySharedRouteTemplateDirective,
  OverlaySharedRouteTemplateOutletComponent,
} from './routing';
import { injectOverlayScrollBlocker } from './scroll-blocker';
import { OverlaySidebarComponent } from './sidebar';

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
  return [
    Dialog,
    provideEnvironmentInitializer(() => {
      injectOverlayScrollBlocker();
    }),
  ];
};
