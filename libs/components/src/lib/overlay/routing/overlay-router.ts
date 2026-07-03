import { Location } from '@angular/common';
import {
  DestroyRef,
  InjectionToken,
  Provider,
  Signal,
  Type,
  computed,
  effect,
  inject,
  isSignal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { createComponentId, fromNextFrame, injectQueryParam, injectRoute } from '@ethlete/core';
import { map, switchMap } from 'rxjs';
import { OVERLAY_REF } from '../overlay-ref';

export const OVERLAY_ROUTER_CONFIG_TOKEN = new InjectionToken<OverlayRouterConfig>('OVERLAY_ROUTER_CONFIG_TOKEN');

export type OverlayRoute = {
  /** The component to render. */
  component: Type<unknown>;

  /**
   * The route of the page.
   *
   * @example
   * "/" // The root route
   * "/two" // The route "two"
   */
  path: `/${string}`;

  /** The inputs to pass to the component. Signal values are unwrapped. */
  inputs?: Record<string, unknown>;
};

export type OverlayRouterConfig = {
  /** The routes to be able to navigate to. */
  routes: OverlayRoute[];

  /**
   * The route on which to start.
   * @default routes[0].path // The first route, or "/" if none is defined
   */
  initialRoute?: string;

  /**
   * Mirror the active overlay route into the browser URL as a query param, enabling deep-linking and
   * browser back/forward integration. Requires the Angular `Router` to be available.
   *
   * @default false
   */
  syncUrl?: boolean;
};

export type OverlayRouterNavigationDirection = 'forward' | 'backward';

export type OverlayRouterNavigateConfig = {
  navigationDirection?: OverlayRouterNavigationDirection;
};

export type OverlayRouterTransitionType = 'slide' | 'fade' | 'overlay' | 'vertical' | 'none';

export class OverlayRouterService {
  private overlayRef = inject(OVERLAY_REF);
  private config = inject(OVERLAY_ROUTER_CONFIG_TOKEN);
  private location = inject(Location, { optional: true });
  private id = createComponentId('ovr');
  private syncUrl = this.config.syncUrl ?? false;

  private router: Router | null = null;
  private route: Signal<string> | null = null;

  private syncCurrentRoute = signal(this.getInitialRoute());

  /** In-memory navigation history, used to power `back()`/`canGoBack()` independently of the browser. */
  private history = signal<string[]>([]);
  private nativeBrowserBackStack = signal<string[]>([]);

  // The current route, but delayed by one frame to ensure that the needed animation classes are applied.
  currentRoute = toSignal(
    toObservable(this.syncCurrentRoute).pipe(switchMap((r) => fromNextFrame().pipe(map(() => r)))),
    { initialValue: this.getInitialRoute() },
  );

  extraRoutes = signal<OverlayRoute[]>([]);

  transitionType = signal<OverlayRouterTransitionType>('slide');

  navigationDirection = signal<OverlayRouterNavigationDirection>('forward');

  canGoBack = computed(() => this.history().length > 0);

  routes = computed(() => {
    const allRoutes = [...this.config.routes, ...this.extraRoutes()];

    return allRoutes.map((route) => ({
      ...route,
      inputs: Object.entries(route.inputs ?? {}).reduce(
        (acc, [key, value]) => {
          acc[key] = isSignal(value) ? value() : value;

          return acc;
        },
        {} as Record<string, unknown>,
      ),
    }));
  });

  currentPage = computed(() => {
    const currentRoute = this.syncCurrentRoute();

    return this.routes().find((route) => route.path === currentRoute) ?? null;
  });

  constructor() {
    if (this.syncUrl) {
      this.setupUrlSync();
    }

    inject(DestroyRef).onDestroy(() => {
      if (this.syncUrl) {
        // Remove the dialog route from the browser url
        this.updateBrowserUrl(undefined);
      }
    });
  }

  navigate(route: string | (string | number)[], config?: OverlayRouterNavigateConfig) {
    const resolvedRoute = this.resolvePath(route);
    const direction = config?.navigationDirection ?? (resolvedRoute.type === 'back' ? 'backward' : 'forward');

    this.navigationDirection.set(direction);

    const from = this.syncCurrentRoute();

    if (this.updateCurrentRoute(resolvedRoute.route)) {
      this.history.update((history) => (direction === 'backward' ? history.slice(0, -1) : [...history, from]));
    }
  }

  back() {
    if (this.syncUrl && this.location) {
      this.location.back();

      return true;
    }

    const target = this.history().at(-1);

    if (target === undefined) {
      return false;
    }

    this.navigate(target, { navigationDirection: 'backward' });

    return true;
  }

  resolvePath(route: string | (string | number)[]) {
    if (Array.isArray(route)) {
      route = route.join('/');
    }

    if (route === '') {
      route = '/';
    }

    const isAbsolute = route.startsWith('/');
    const isReplaceCurrent = route.startsWith('./');
    const isBack = route.startsWith('../');
    const isForward = !isAbsolute && !isReplaceCurrent && !isBack;

    const curr = this.syncCurrentRoute();

    if (isForward) {
      route = `${curr}/${route}`;
    } else if (isReplaceCurrent) {
      const currSegments = curr.split('/').filter((s) => s !== '');
      currSegments.pop();

      const newSegments = route.split('/').filter((s) => s !== '.');

      route = `/${currSegments.concat(newSegments).join('/')}`;
    } else if (isBack) {
      const currSegments = curr.split('/').filter((s) => s !== '');
      const newSegments = route.split('/').filter((s) => s !== '..');
      const stepsBack = route.split('/').filter((s) => s === '..').length;

      for (let i = 0; i < stepsBack; i++) {
        currSegments.pop();
      }

      route = `/${currSegments.concat(newSegments).join('/')}`;
    }

    return {
      route,
      type:
        isBack || route === '/' ? 'back' : isReplaceCurrent ? 'replace-current' : isAbsolute ? 'absolute' : 'forward',
    } as const;
  }

  addRoute(route: OverlayRoute) {
    this.extraRoutes.set([...this.extraRoutes(), route]);
  }

  removeRoute(path: string) {
    this.extraRoutes.set(this.extraRoutes().filter((r) => r.path !== path));
  }

  /** @internal Returns `true` when the route actually changed. */
  updateCurrentRoute(route: string) {
    if (route === this.syncCurrentRoute()) return false;

    if (this.routes().findIndex((r) => r.path === route) === -1) {
      if (ngDevMode) {
        console.error(`[OverlayRouter] The route "${route}" does not exist.`, this.config);
      }

      return false;
    }

    this.syncCurrentRoute.set(route);
    this.updateBrowserUrl(route);

    return true;
  }

  /** @internal */
  navigateToInitialRoute() {
    this.updateCurrentRoute(this.getInitialRoute());
  }

  private getInitialRoute() {
    return this.config.initialRoute ?? this.config.routes[0]?.path ?? '/';
  }

  private setupUrlSync() {
    const router = inject(Router, { optional: true });

    if (!router) {
      if (ngDevMode) {
        console.warn('[OverlayRouter] `syncUrl` is enabled but no Angular Router is available. URL sync is disabled.');
      }

      this.syncUrl = false;

      return;
    }

    this.router = router;
    this.route = injectRoute();

    const currentRouteQueryParam = injectQueryParam(this.id);

    this.updateBrowserUrl(this.syncCurrentRoute());

    let isFirstRouteEvent = true;

    effect(() => {
      const route = currentRouteQueryParam();

      untracked(() => {
        if (isFirstRouteEvent) {
          isFirstRouteEvent = false;

          return;
        }

        // The user navigated back or forward using the browser history
        if (!route) {
          // The route query param no longer exists - close the overlay
          this.overlayRef.close();
        } else if (route !== this.syncCurrentRoute()) {
          const navStack = this.nativeBrowserBackStack();
          const currentRoute = this.syncCurrentRoute();

          if (!navStack.length) {
            // If the nav stack is empty the only way to navigate is back.
            this.navigate(route, { navigationDirection: 'backward' });
            this.nativeBrowserBackStack.set([currentRoute]);
          } else {
            const lastItem = navStack[navStack.length - 1];

            if (route === lastItem) {
              // Going forward again.
              this.navigate(route, { navigationDirection: 'forward' });
              this.nativeBrowserBackStack.set(navStack.slice(0, -1));
            } else {
              // Going back.
              this.navigate(route, { navigationDirection: 'backward' });
              this.nativeBrowserBackStack.set([...navStack, currentRoute]);
            }
          }
        } else {
          // The navigation was triggered by ui interaction. Clear the back nav stack.
          this.nativeBrowserBackStack.set([]);
        }
      });
    });
  }

  private updateBrowserUrl(route: string | undefined) {
    if (!this.router || !this.route) return;

    this.router.navigate([this.route()], {
      queryParams: { [this.id]: route },
      queryParamsHandling: 'merge',
    });
  }
}

export const provideOverlayRouterConfig = (config: OverlayRouterConfig): Provider[] => {
  return [
    {
      provide: OVERLAY_ROUTER_CONFIG_TOKEN,
      useValue: config,
    },
  ];
};

/**
 * Provides both the overlay router config and the {@link OverlayRouterService}, so a consumer only needs
 * a single entry in the overlay's `providers` instead of wiring the service separately.
 *
 * @example
 * overlayManager.open(MyOverlay, {
 *   strategies: dialogOverlayStrategy(),
 *   providers: [provideOverlayRouter({ routes: [...] })],
 * });
 */
export const provideOverlayRouter = (config: OverlayRouterConfig): Provider[] => {
  return [...provideOverlayRouterConfig(config), OverlayRouterService];
};
