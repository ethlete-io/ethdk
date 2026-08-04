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

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OverlayImports = [
  OverlayCloseDirective,
  OverlayTitleDirective,
  OverlayHeaderDirective,
  OverlayBodyComponent,
  OverlayFooterDirective,
  OverlayMainDirective,
] as const;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OverlayWithSidebarImports = [...OverlayWithRoutingImports, OverlaySidebarComponent] as const;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideOverlay = () => {
  return [
    Dialog,
    provideEnvironmentInitializer(() => {
      injectOverlayScrollBlocker();
    }),
  ];
};
