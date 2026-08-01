import {
  InjectionToken,
  Provider,
  Signal,
  TemplateRef,
  WritableSignal,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  Breakpoint,
  defineProvider,
  injectBreakpointObserver,
  signalElementDimensions,
  toInjectFn,
  toProvideFn,
  toToken,
} from '@ethlete/core';
import { distinctUntilChanged, tap } from 'rxjs';
import { OverlayBodyDividerType } from '../overlay-body.component';
import { OverlayHeaderTemplateDirective } from '../overlay-header-template.directive';
import { OVERLAY_REF } from '../overlay-ref';
import { injectOverlayRouter } from '../routing/overlay-router';
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

export type SidebarOverlay = {
  /** Whether the sidebar renders inline (`true`) or is collapsed into a navigable page (`false`). */
  renderSidebar: Signal<boolean>;

  sidebarContentTemplate: WritableSignal<TemplateRef<unknown> | null>;
  sidebarHeaderTemplate: WritableSignal<OverlayHeaderTemplateDirective | null>;
  sidebarPageDividers: WritableSignal<OverlayBodyDividerType>;
};

const SIDEBAR_OVERLAY_DEF = /* @__PURE__ */ defineProvider(
  (): SidebarOverlay => {
    const config = inject(SIDEBAR_OVERLAY_CONFIG);
    const router = injectOverlayRouter();
    const overlayRef = inject(OVERLAY_REF);
    const breakpointObserver = injectBreakpointObserver();

    const threshold =
      typeof config.renderSidebarFrom === 'number'
        ? config.renderSidebarFrom
        : breakpointObserver.getBreakpointSize(config.renderSidebarFrom ?? 'md', 'min');

    const paneElement = signal<HTMLElement | null>(null);
    const paneDimensions = signalElementDimensions(paneElement);

    const renderSidebar = computed(() => {
      const width = paneDimensions().offset?.width ?? null;

      return width !== null && width >= threshold;
    });

    const sidebarContentTemplate = signal<TemplateRef<unknown> | null>(null);
    const sidebarHeaderTemplate = signal<OverlayHeaderTemplateDirective | null>(null);
    const sidebarPageDividers = signal<OverlayBodyDividerType>(false);

    afterNextRender(() => paneElement.set(overlayRef.elements?.paneElement ?? null));

    const sidebarPageRoute = config.sidebarPageRoute ?? '/sidebar';

    toObservable(renderSidebar)
      .pipe(
        distinctUntilChanged(),
        tap((render) => {
          if (render) {
            router.transitionType.set('vertical');
            router.removeRoute(sidebarPageRoute);

            // if the user is currently on the sidebar route, navigate to the initial route.
            if (router.currentRoute() === sidebarPageRoute) {
              router.navigateToInitialRoute();
            }
          } else {
            router.transitionType.set('overlay');

            router.addRoute({
              path: sidebarPageRoute,
              component: OverlaySidebarPageComponent,
              inputs: {
                headerTemplate: sidebarHeaderTemplate,
                bodyTemplate: sidebarContentTemplate,
                pageDividers: sidebarPageDividers,
              },
              // the sidebar conceptually sits to the left of the content pages: it slides in
              // from the left and content pages slide back in from the right when leaving it
              navigationDirection: { to: 'backward', from: 'forward' },
            });
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    return {
      renderSidebar,
      sidebarContentTemplate,
      sidebarHeaderTemplate,
      sidebarPageDividers,
    };
  },
  { name: 'SidebarOverlay' },
);

export const provideSidebarOverlayService = /* @__PURE__ */ toProvideFn(SIDEBAR_OVERLAY_DEF);
export const injectSidebarOverlay = /* @__PURE__ */ toInjectFn(SIDEBAR_OVERLAY_DEF);
export const SIDEBAR_OVERLAY_TOKEN = /* @__PURE__ */ toToken(SIDEBAR_OVERLAY_DEF);

export const provideSidebarOverlayConfig = (config: SidebarOverlayConfig): Provider[] => {
  return [
    {
      provide: SIDEBAR_OVERLAY_CONFIG,
      useValue: config,
    },
  ];
};

/**
 * Provides both the sidebar config and the sidebar overlay service in one call, mirroring
 * {@link provideOverlayRouter}. Requires an overlay router to also be provided.
 */
export const provideSidebarOverlay = (config: SidebarOverlayConfig = {}): Provider[] => {
  return [...provideSidebarOverlayConfig(config), ...provideSidebarOverlayService()];
};
