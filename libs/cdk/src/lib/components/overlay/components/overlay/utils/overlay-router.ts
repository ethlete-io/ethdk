import { ComponentType } from '@angular/cdk/portal';
import {
  DestroyRef,
  InjectionToken,
  Provider,
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
import { OverlayRef } from './overlay-ref';

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

export type OverlayRouterNavigateConfig = {
  navigationDirection?: OverlayRouterNavigationDirection;
};

export type OverlayRouterTransitionType = 'slide' | 'fade' | 'overlay' | 'vertical' | 'none';

export class OverlayRouterService {
  _router = inject(Router);
  _id = createComponentId('ovr');
  _overlayRef = inject(OverlayRef);
  _config = inject(OVERLAY_ROUTER_CONFIG_TOKEN);

  _syncCurrentRoute = signal(this._getInitialRoute());
  _nativeBrowserTempBackNavigationStack = signal<string[]>([]);

  // The current route, but delayed by one frame to ensure that the needed animation classes are applied.
  currentRoute = toSignal(
    toObservable(this._syncCurrentRoute).pipe(switchMap((r) => fromNextFrame().pipe(map(() => r)))),
    { initialValue: this._getInitialRoute() },
  );

  extraRoutes = signal<OverlayRoute[]>([]);

  transitionType = signal<OverlayRouterTransitionType>('slide');

  currentRouteQueryParam = injectQueryParam(this._id);
  route = injectRoute();

  routes = computed(() => {
    const allRoutes = [...this._config.routes, ...this.extraRoutes()];

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
    const currentRoute = this._syncCurrentRoute();

    for (const route of this.routes()) {
      if (route.path === currentRoute) {
        return route;
      }
    }

    return null;
  });

  navigationDirection = signal<OverlayRouterNavigationDirection>('forward');

  constructor() {
    this._disableCloseOnNavigation();
    this._updateBrowserUrl(this._syncCurrentRoute());

    effect(() => {
      const route = this.currentRouteQueryParam();

      untracked(() => {
        // FIXME: Check if we still need to skip the first route event

        // The user navigated back or forward using the browser history
        if (!route) {
          // The route query param no longer exists - close the overlay
          this._overlayRef.close();
        } else if (route !== this._syncCurrentRoute()) {
          const navStack = this._nativeBrowserTempBackNavigationStack();
          const currentRoute = this._syncCurrentRoute();

          if (!navStack.length) {
            // If the nav stack is empty the only way to navigate is back.
            this.navigate(route, { navigationDirection: 'backward' });
            this._nativeBrowserTempBackNavigationStack.set([currentRoute]);
          } else {
            const lastItem = navStack[navStack.length - 1];

            if (route === lastItem) {
              // The new route matches the last item in the back nav stack.
              // This means we are going forward again.
              this.navigate(route, { navigationDirection: 'forward' });
              this._nativeBrowserTempBackNavigationStack.set(navStack.slice(0, -1));
            } else {
              // Else we are going back.
              this.navigate(route, { navigationDirection: 'backward' });
              this._nativeBrowserTempBackNavigationStack.set([...navStack, currentRoute]);
            }
          }
        } else {
          // The navigation was triggered by ui interaction. Clear the back nav stack.
          this._nativeBrowserTempBackNavigationStack.set([]);
        }
      });
    });

    inject(DestroyRef).onDestroy(() => {
      // Remove the dialog route from the browser url
      this._updateBrowserUrl(undefined);
    });
  }

  navigate(route: string | (string | number)[], config?: OverlayRouterNavigateConfig) {
    const resolvedRoute = this.resolvePath(route);
    if (config?.navigationDirection) {
      this.navigationDirection.set(config.navigationDirection);
    } else if (resolvedRoute.type === 'back') {
      this.navigationDirection.set('backward');
    } else {
      this.navigationDirection.set('forward');
    }

    this._updateCurrentRoute(resolvedRoute.route);
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

    const curr = this._syncCurrentRoute();

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

  _updateCurrentRoute(route: string) {
    if (route === this._syncCurrentRoute()) return;

    if (this.routes().findIndex((r) => r.path === route) === -1) {
      console.error(`The route "${route}" does not exist.`, this._config);
      return;
    }

    this._syncCurrentRoute.set(route);

    this._updateBrowserUrl(route);
  }

  _getInitialRoute() {
    return this._config.initialRoute ?? this._config.routes[0]?.path ?? '/';
  }

  _navigateToInitialRoute() {
    this._updateCurrentRoute(this._getInitialRoute());
  }

  _updateBrowserUrl(route: string | undefined) {
    this._router.navigate([this.route()], {
      queryParams: { [this._id]: route },
      queryParamsHandling: 'merge',
    });
  }

  private _disableCloseOnNavigation() {
    // @ts-expect-error - private property
    this._overlayRef._cdkRef.overlayRef._locationChanges?.unsubscribe?.();
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
