import { InjectionToken, Provider, TemplateRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Breakpoint, injectBreakpointObserver, signalElementDimensions } from '@ethlete/core';
import { distinctUntilChanged, tap } from 'rxjs';
import { OverlayBodyDividerType } from '../overlay-body.component';
import { OverlayHeaderTemplateDirective } from '../overlay-header-template.directive';
import { OVERLAY_REF } from '../overlay-ref';
import { OverlayRouterService } from '../routing/overlay-router';
import { OverlaySidebarPageComponent } from './overlay-sidebar-page.component';

export const SIDEBAR_OVERLAY_CONFIG = new InjectionToken<SidebarOverlayConfig>('SIDEBAR_OVERLAY_CONFIG');

export type SidebarOverlayConfig = {
  /**
   * On mobile devices, the sidebar is shown as a separate page that can be navigated to.
   * This is the route to that sidebar page.
   *
   * @default "/sidebar"
   */
  sidebarPageRoute?: `/${string}`;

  /**
   * The width from which the sidebar renders inline (rather than collapsing into a page). Compared
   * against the overlay's own pane width — not the viewport — so a narrow dialog collapses its
   * sidebar even on a wide screen. Can be a breakpoint name or a pixel number. Works best with an
   * overlay that has a defined width.
   *
   * @default "md"
   */
  renderSidebarFrom?: Breakpoint | number;
};

export class SidebarOverlayService {
  private config = inject(SIDEBAR_OVERLAY_CONFIG);
  private router = inject(OverlayRouterService);
  private overlayRef = inject(OVERLAY_REF);
  private breakpointObserver = injectBreakpointObserver();

  private threshold =
    typeof this.config.renderSidebarFrom === 'number'
      ? this.config.renderSidebarFrom
      : this.breakpointObserver.getBreakpointSize(this.config.renderSidebarFrom ?? 'md', 'min');

  private paneElement = signal<HTMLElement | null>(null);
  private paneDimensions = signalElementDimensions(this.paneElement);

  renderSidebar = computed(() => {
    const width = this.paneDimensions().offset?.width ?? null;

    return width !== null && width >= this.threshold;
  });

  sidebarContentTemplate = signal<TemplateRef<unknown> | null>(null);
  sidebarHeaderTemplate = signal<OverlayHeaderTemplateDirective | null>(null);
  sidebarPageDividers = signal<OverlayBodyDividerType>(false);

  constructor() {
    afterNextRender(() => this.paneElement.set(this.overlayRef.elements?.paneElement ?? null));

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
              this.router.navigateToInitialRoute();
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

/**
 * Provides both the sidebar config and the {@link SidebarOverlayService} in one call, mirroring
 * {@link provideOverlayRouter}. Requires an overlay router to also be provided.
 */
export const provideSidebarOverlay = (config: SidebarOverlayConfig = {}): Provider[] => {
  return [...provideSidebarOverlayConfig(config), SidebarOverlayService];
};
