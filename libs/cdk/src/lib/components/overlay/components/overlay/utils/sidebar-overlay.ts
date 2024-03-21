import { Injectable, InjectionToken, TemplateRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Breakpoint, ViewportService } from '@ethlete/core';
import { distinctUntilChanged, tap } from 'rxjs';
import { OverlayHeaderTemplateDirective } from '../partials/overlay-header-template';
import { OverlaySidebarPageComponent } from '../partials/overlay-sidebar-page';
import { OverlayRouterService } from './overlay-router';

export const SIDEBAR_OVERLAY_CONFIG = new InjectionToken<SidebarOverlayConfig>('SIDEBAR_OVERLAY_CONFIG');

export type SidebarOverlayConfig = {
  /**
   * On mobile devices, the sidebar will be shown as a separate page that can be navigated to.
   * This is the route to the sidebar page.
   *
   * @default "/sidebar"
   */
  sidebarPageRoute?: `/${string}`;

  /**
   * The breakpoint from which to render the sidebar. Can be a breakpoint or a number representing the pixel width.
   * @default "md"
   */
  renderSidebarFrom?: Breakpoint | number;
};

@Injectable()
export class SidebarOverlayService {
  config = inject(SIDEBAR_OVERLAY_CONFIG);
  viewportService = inject(ViewportService);
  router = inject(OverlayRouterService);

  renderSidebar = toSignal(this.viewportService.observe({ min: this.config.renderSidebarFrom ?? 'md' }), {
    initialValue: this.viewportService.isMatched({ min: this.config.renderSidebarFrom ?? 'md' }),
  });

  sidebarContentTemplate = signal<TemplateRef<unknown> | null>(null);
  sidebarHeaderTemplate = signal<OverlayHeaderTemplateDirective | null>(null);

  constructor() {
    const sidebarPageRoute = this.config.sidebarPageRoute ?? '/sidebar';

    toObservable(this.renderSidebar)
      .pipe(
        distinctUntilChanged(),
        tap((renderSidebar) => {
          if (renderSidebar) {
            this.router.removeRoute(sidebarPageRoute);

            this.router.rootHistoryItem.set(null);

            // if the user is currently on the sidebar route, navigate to the initial route.
            if (this.router.currentRoute() === sidebarPageRoute) {
              this.router._navigateToInitialRoute();
            }

            // clean up all history entries that are the sidebar route.
            // we don't want to navigate to the sidebar route if the sidebar is already visible as a actual sidebar.
            this.router._removeItemFromHistory(sidebarPageRoute);
          } else {
            this.router.addRoute({
              path: sidebarPageRoute,
              component: OverlaySidebarPageComponent,
              inputs: {
                headerTemplate: this.sidebarHeaderTemplate,
                bodyTemplate: this.sidebarContentTemplate,
              },
            });

            // ensure that the sidebar route is always the last route in the history so it can be reached.
            this.router.rootHistoryItem.set(sidebarPageRoute);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

export const provideSidebarOverlayConfig = (config: SidebarOverlayConfig) => {
  return [
    {
      provide: SIDEBAR_OVERLAY_CONFIG,
      useValue: config,
    },
    SidebarOverlayService,
  ];
};
