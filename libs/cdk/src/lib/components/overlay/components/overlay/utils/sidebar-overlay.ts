import { InjectionToken, Provider, TemplateRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Breakpoint, ViewportService } from '@ethlete/core';
import { distinctUntilChanged, tap } from 'rxjs';
import { OverlayBodyDividerType } from '../partials/overlay-body';
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

export class SidebarOverlayService {
  config = inject(SIDEBAR_OVERLAY_CONFIG);
  viewportService = inject(ViewportService);
  router = inject(OverlayRouterService);

  renderSidebar = toSignal(this.viewportService.observe({ min: this.config.renderSidebarFrom ?? 'md' }), {
    initialValue: this.viewportService.isMatched({ min: this.config.renderSidebarFrom ?? 'md' }),
  });

  sidebarContentTemplate = signal<TemplateRef<unknown> | null>(null);
  sidebarHeaderTemplate = signal<OverlayHeaderTemplateDirective | null>(null);
  sidebarPageDividers = signal<OverlayBodyDividerType>(false);

  constructor() {
    const sidebarPageRoute = this.config.sidebarPageRoute ?? '/sidebar';

    toObservable(this.renderSidebar)
      .pipe(
        distinctUntilChanged(),
        tap((renderSidebar) => {
          if (renderSidebar) {
            this.router.transitionType.set('vertical');

            this.router.removeRoute(sidebarPageRoute);

            // if the user is currently on the sidebar route, navigate to the initial route.
            if (this.router.currentRoute() === sidebarPageRoute) {
              this.router._navigateToInitialRoute();
            }
          } else {
            this.router.transitionType.set('overlay');

            this.router.addRoute({
              path: sidebarPageRoute,
              component: OverlaySidebarPageComponent,
              inputs: {
                headerTemplate: this.sidebarHeaderTemplate,
                bodyTemplate: this.sidebarContentTemplate,
                pageDividers: this.sidebarPageDividers,
              },
            });
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

export const provideSidebarOverlayConfig = (config: SidebarOverlayConfig): Provider[] => {
  return [
    {
      provide: SIDEBAR_OVERLAY_CONFIG,
      useValue: config,
    },
  ];
};
