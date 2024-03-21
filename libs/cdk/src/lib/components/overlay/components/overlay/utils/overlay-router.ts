import { ComponentType } from '@angular/cdk/portal';
import { Injectable, InjectionToken, computed, inject, isSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { fromNextFrame } from '@ethlete/core';
import { map, switchMap } from 'rxjs';

export const OVERLAY_ROUTER_CONFIG_TOKEN = new InjectionToken<OverlayRouterConfig>('OVERLAY_ROUTER_CONFIG_TOKEN');

export type OverlayRoute = {
  /**
   * The component to render.
   */
  component: ComponentType<unknown>;

  /**
   * The route of the page.
   *
   * @example
   * "/" // The root route
   * "/two" // The route "two"
   */
  path: `/${string}`;

  /**
   * The inputs to pass to the component.
   */
  inputs?: Record<string, unknown>;
};

export type OverlayRouterConfig = {
  /**
   * The routes to be able to navigate to.
   */
  routes: OverlayRoute[];

  /**
   * The route on which to start.
   * @default "" // The root route
   * @default routes[0].path // The first route if no root route is defined
   */
  initialRoute?: string;
};

export type OverlayRouterNavigationDirection = 'forward' | 'backward';

@Injectable()
export class OverlayRouterService {
  config = inject(OVERLAY_ROUTER_CONFIG_TOKEN);

  syncCurrentRoute = signal('/');

  // The current route, but delayed by one frame to ensure that the needed animation classes are applied.
  currentRoute = toSignal(
    toObservable(this.syncCurrentRoute).pipe(switchMap((r) => fromNextFrame().pipe(map(() => r)))),
    { initialValue: '/' },
  );

  routeHistory = signal<string[]>([]);
  rootHistoryItem = signal<string | null>(null);
  extraRoutes = signal<OverlayRoute[]>([]);

  routes = computed(() => {
    const allRoutes = [...this.config.routes, ...this.extraRoutes()];

    const allRoundsWithTransformedInputs = allRoutes.map((route) => {
      return {
        ...route,
        inputs: Object.entries(route.inputs ?? {}).reduce(
          (acc, [key, value]) => {
            if (isSignal(value)) {
              acc[key] = value();
            } else {
              acc[key] = value;
            }

            return acc;
          },
          {} as Record<string, unknown>,
        ),
      };
    });

    return allRoundsWithTransformedInputs;
  });

  currentPage = computed(() => {
    const currentRoute = this.syncCurrentRoute();

    for (const route of this.routes()) {
      if (route.path === currentRoute) {
        return route;
      }
    }

    return null;
  });

  lastPage = computed(() => {
    const history = this.routeHistory();

    if (history.length) {
      return history[history.length - 1];
    }

    return null;
  });

  canGoBack = computed(() => {
    return this.routeHistory().length;
  });

  navigationDirection = signal<OverlayRouterNavigationDirection>('forward');

  constructor() {
    this._navigateToInitialRoute();
  }

  navigate(route: string | (string | number)[]) {
    const resolvedRoute = this.resolvePath(route);

    if (resolvedRoute.type === 'back') {
      this.navigationDirection.set('backward');
    } else {
      this.navigationDirection.set('forward');
    }

    this._updateCurrentRoute(resolvedRoute.route);
  }

  back() {
    const prevRoute = this.lastPage();

    if (!prevRoute) return;

    this.navigationDirection.set('backward');

    this.routeHistory.set(this.routeHistory().slice(0, -1));
    this._updateCurrentRoute(prevRoute, { updateHistory: false });
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
        isBack || route === '/'
          ? 'back'
          : isReplaceCurrent
            ? 'replace-current'
            : isAbsolute
              ? 'absolute'
              : isForward
                ? 'forward'
                : 'unknown',
    } as const;
  }

  addRoute(route: OverlayRoute) {
    this.extraRoutes.set([...this.extraRoutes(), route]);
  }

  removeRoute(path: string) {
    this.extraRoutes.set(this.extraRoutes().filter((r) => r.path !== path));
  }

  _updateCurrentRoute(route: string, config?: { updateHistory?: boolean }) {
    if (route === this.syncCurrentRoute()) return;

    if (this.routes().findIndex((r) => r.path === route) === -1) {
      console.error(`The route "${route}" does not exist.`, this.config);
      return;
    }

    const lastRoute = this.syncCurrentRoute();

    if (config?.updateHistory === true || config?.updateHistory === undefined) {
      const history = this.routeHistory();

      if (history[history.length - 1] !== lastRoute) {
        const newHistory = [...history, lastRoute];

        // limit the history to 25 items
        if (newHistory.length > 25) {
          newHistory.shift();
        }

        const rootHistoryItem = this.rootHistoryItem();
        if (rootHistoryItem && newHistory[0] !== rootHistoryItem) {
          newHistory.unshift(rootHistoryItem);
        }

        this.routeHistory.set(newHistory);
      }
    }

    this.syncCurrentRoute.set(route);
  }

  _removeItemFromHistory(item: string) {
    const history = this.routeHistory();
    const cleanedHistory = history.filter((i) => i !== item);

    if (cleanedHistory.length === 1 && cleanedHistory[0] === this.syncCurrentRoute()) {
      this.routeHistory.set([]);
    } else {
      this.routeHistory.set(cleanedHistory);
    }
  }

  _navigateToInitialRoute() {
    if (this.config.initialRoute) {
      this._updateCurrentRoute(this.config.initialRoute ?? '/', { updateHistory: false });
    } else {
      const first = this.config.routes[0]?.path;
      this._updateCurrentRoute(first ?? '/', { updateHistory: false });
    }
  }
}

export const provideOverlayRouterConfig = (config: OverlayRouterConfig) => {
  return [
    {
      provide: OVERLAY_ROUTER_CONFIG_TOKEN,
      useValue: config,
    },
    OverlayRouterService,
  ];
};
