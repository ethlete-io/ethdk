import { Location } from '@angular/common';
import {
  DestroyRef,
  InjectionToken,
  Provider,
  Signal,
  Type,
  WritableSignal,
  computed,
  effect,
  inject,
  isSignal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  createComponentId,
  defineProvider,
  fromNextFrame,
  injectQueryParam,
  injectRoute,
  toInjectFn,
  toProvideFn,
  toToken,
} from '@ethlete/core';
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

  /**
   * Overrides the animation direction used when navigating to or away from this route.
   * Useful for routes that conceptually sit "before" the others, like a sidebar page that
   * should slide in from the left. An explicit direction passed to `navigate()` always wins.
   */
  navigationDirection?: {
    /** Direction to play when this route becomes active. */
    to?: OverlayRouterNavigationDirection;

    /** Direction to play when navigating away from this route. */
    from?: OverlayRouterNavigationDirection;
  };
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

export type OverlayRouterNavigationGuardContext = {
  from: string;

  /** The resolved route being navigated to. */
  to: string;
};

export type OverlayRouterNavigationGuard = (context: OverlayRouterNavigationGuardContext) => boolean | Promise<boolean>;

export type OverlayRouterTransitionType = 'slide' | 'fade' | 'overlay' | 'vertical' | 'none';

export type OverlayRouterResolvedPath = {
  route: string;
  type: 'back' | 'replace-current' | 'absolute' | 'forward';
};

export type OverlayRouter = {
  /** The current route, but delayed by one frame to ensure that the needed animation classes are applied. */
  currentRoute: Signal<string>;

  /** Routes registered at runtime in addition to the configured ones. */
  extraRoutes: WritableSignal<OverlayRoute[]>;

  /** The transition to play when navigating between routes. */
  transitionType: WritableSignal<OverlayRouterTransitionType>;

  /** The direction of the current navigation. */
  navigationDirection: WritableSignal<OverlayRouterNavigationDirection>;

  /** Whether an in-memory history entry exists to go back to. */
  canGoBack: Signal<boolean>;

  /**
   * Whether a navigation is in flight - waiting on a navigation guard, or committed but not yet
   * observable on `currentRoute`. UI that moves ahead of the router - a tab bar selecting the clicked
   * tab optimistically - must not undo itself while this is `true`, or it fights that navigation.
   */
  navigationPending: Signal<boolean>;

  /** All navigable routes (configured + extra) with signal inputs unwrapped. */
  routes: Signal<OverlayRoute[]>;

  /** The route currently being displayed. */
  currentPage: Signal<OverlayRoute | null>;

  navigate: (route: string | (string | number)[], config?: OverlayRouterNavigateConfig) => void;

  /**
   * Registers a check run before every route change, including the ones the browser's back and
   * forward buttons trigger. Resolving `false` cancels the navigation. Returns a function that
   * unregisters the check again.
   *
   * @example
   * inject(DestroyRef).onDestroy(router.registerNavigationGuard(() => confirmDiscard()));
   */
  registerNavigationGuard: (guard: OverlayRouterNavigationGuard) => () => void;

  back: () => boolean;

  resolvePath: (route: string | (string | number)[]) => OverlayRouterResolvedPath;

  addRoute: (route: OverlayRoute) => void;

  removeRoute: (path: string) => void;

  /** @internal Returns `true` when the route actually changed. */
  updateCurrentRoute: (route: string) => boolean;

  /** @internal */
  navigateToInitialRoute: () => void;
};

const OVERLAY_ROUTER_DEF = /* @__PURE__ */ defineProvider(
  (): OverlayRouter => {
    const overlayRef = inject(OVERLAY_REF);
    const config = inject(OVERLAY_ROUTER_CONFIG_TOKEN);
    const location = inject(Location, { optional: true });
    const id = createComponentId('ovr');
    let syncUrl = config.syncUrl ?? false;

    let router: Router | null = null;
    let route: Signal<string> | null = null;

    const getInitialRoute = () => config.initialRoute ?? config.routes[0]?.path ?? '/';

    const syncCurrentRoute = signal(getInitialRoute());

    /** In-memory navigation history, used to power `back()`/`canGoBack()` independently of the browser. */
    const history = signal<string[]>([]);
    const nativeBrowserBackStack = signal<string[]>([]);
    const pendingNavigations = signal(0);

    // The current route, but delayed by one frame to ensure that the needed animation classes are applied.
    const currentRoute = toSignal(
      toObservable(syncCurrentRoute).pipe(switchMap((r) => fromNextFrame().pipe(map(() => r)))),
      { initialValue: getInitialRoute() },
    );

    // A commit stays invisible on `currentRoute` for a frame, so the route being left still reports
    // itself active in there. Both halves must count as pending, or an optimistic selection is undone.
    const navigationPending = computed(() => pendingNavigations() > 0 || currentRoute() !== syncCurrentRoute());

    const extraRoutes = signal<OverlayRoute[]>([]);

    const transitionType = signal<OverlayRouterTransitionType>('slide');

    const navigationDirection = signal<OverlayRouterNavigationDirection>('forward');

    const canGoBack = computed(() => history().length > 0);

    const routes = computed(() => {
      const allRoutes = [...config.routes, ...extraRoutes()];

      return allRoutes.map((r) => ({
        ...r,
        inputs: Object.entries(r.inputs ?? {}).reduce(
          (acc, [key, value]) => {
            acc[key] = isSignal(value) ? value() : value;

            return acc;
          },
          {} as Record<string, unknown>,
        ),
      }));
    });

    const currentPage = computed(() => {
      const curr = syncCurrentRoute();

      return routes().find((r) => r.path === curr) ?? null;
    });

    const updateBrowserUrl = (r: string | undefined) => {
      if (!router || !route) return;

      router.navigate([route()], {
        queryParams: { [id]: r },
        queryParamsHandling: 'merge',
      });
    };

    const updateCurrentRoute = (r: string) => {
      if (r === syncCurrentRoute()) return false;

      if (routes().findIndex((rt) => rt.path === r) === -1) {
        if (ngDevMode) {
          console.error(`[OverlayRouter] The route "${r}" does not exist.`, config);
        }

        return false;
      }

      syncCurrentRoute.set(r);
      updateBrowserUrl(r);

      return true;
    };

    const resolvePath = (r: string | (string | number)[]): OverlayRouterResolvedPath => {
      if (Array.isArray(r)) {
        r = r.join('/');
      }

      if (r === '') {
        r = '/';
      }

      const isAbsolute = r.startsWith('/');
      const isReplaceCurrent = r.startsWith('./');
      const isBack = r.startsWith('../');
      const isForward = !isAbsolute && !isReplaceCurrent && !isBack;

      const curr = syncCurrentRoute();

      if (isForward) {
        r = `${curr}/${r}`;
      } else if (isReplaceCurrent) {
        const currSegments = curr.split('/').filter((s) => s !== '');
        currSegments.pop();

        const newSegments = r.split('/').filter((s) => s !== '.');

        r = `/${currSegments.concat(newSegments).join('/')}`;
      } else if (isBack) {
        const currSegments = curr.split('/').filter((s) => s !== '');
        const newSegments = r.split('/').filter((s) => s !== '..');
        const stepsBack = r.split('/').filter((s) => s === '..').length;

        for (let i = 0; i < stepsBack; i++) {
          currSegments.pop();
        }

        r = `/${currSegments.concat(newSegments).join('/')}`;
      }

      return {
        route: r,
        type: isBack || r === '/' ? 'back' : isReplaceCurrent ? 'replace-current' : isAbsolute ? 'absolute' : 'forward',
      };
    };

    const navigationGuards = new Set<OverlayRouterNavigationGuard>();

    const registerNavigationGuard = (guard: OverlayRouterNavigationGuard) => {
      navigationGuards.add(guard);

      return () => {
        navigationGuards.delete(guard);
      };
    };

    /**
     * Answers synchronously while nothing is registered: a route change deferred by a microtask lands
     * after the frame the outlet measured for its transition.
     */
    const canLeave = (from: string, to: string): boolean | Promise<boolean> => {
      const guards = [...navigationGuards];

      if (!guards.length) {
        return true;
      }

      return guards.reduce<Promise<boolean>>(
        (mayLeave, guard) => mayLeave.then((allowed) => (allowed ? guard({ from, to }) : false)),
        Promise.resolve(true),
      );
    };

    const whenAllowed = (attempt: { from: string; to: string; allowed: () => void; blocked?: () => void }) => {
      const result = canLeave(attempt.from, attempt.to);

      if (result === true) {
        attempt.allowed();

        return;
      }

      pendingNavigations.update((count) => count + 1);

      void Promise.resolve(result).then((mayLeave) => {
        pendingNavigations.update((count) => count - 1);

        return mayLeave ? attempt.allowed() : attempt.blocked?.();
      });
    };

    const commitNavigation = (commit: {
      resolvedRoute: OverlayRouterResolvedPath;
      from: string;
      navigateConfig?: OverlayRouterNavigateConfig;
    }) => {
      const { resolvedRoute, from, navigateConfig } = commit;

      const allRoutes = routes();
      const targetDirectionHint = allRoutes.find((rt) => rt.path === resolvedRoute.route)?.navigationDirection?.to;
      const sourceDirectionHint = allRoutes.find((rt) => rt.path === from)?.navigationDirection?.from;

      const defaultDirection = resolvedRoute.type === 'back' ? 'backward' : 'forward';

      // Route hints only affect the played animation. The history bookkeeping below must stay
      // tied to the actual navigation semantics, or `back()` would misbehave for hinted routes.
      const historyDirection = navigateConfig?.navigationDirection ?? defaultDirection;
      const animationDirection =
        navigateConfig?.navigationDirection ?? targetDirectionHint ?? sourceDirectionHint ?? defaultDirection;

      navigationDirection.set(animationDirection);

      if (updateCurrentRoute(resolvedRoute.route)) {
        history.update((h) => (historyDirection === 'backward' ? h.slice(0, -1) : [...h, from]));
      }
    };

    const navigate = (r: string | (string | number)[], navigateConfig?: OverlayRouterNavigateConfig) => {
      const resolvedRoute = resolvePath(r);
      const from = syncCurrentRoute();

      if (resolvedRoute.route === from) {
        return;
      }

      whenAllowed({
        from,
        to: resolvedRoute.route,
        allowed: () => commitNavigation({ resolvedRoute, from, navigateConfig }),
      });
    };

    const back = () => {
      if (syncUrl && location) {
        location.back();

        return true;
      }

      const target = history().at(-1);

      if (target === undefined) {
        return false;
      }

      navigate(target, { navigationDirection: 'backward' });

      return true;
    };

    const addRoute = (r: OverlayRoute) => {
      extraRoutes.set([...extraRoutes(), r]);
    };

    const removeRoute = (path: string) => {
      extraRoutes.set(extraRoutes().filter((r) => r.path !== path));
    };

    const navigateToInitialRoute = () => {
      updateCurrentRoute(getInitialRoute());
    };

    const setupUrlSync = () => {
      const angularRouter = inject(Router, { optional: true });

      if (!angularRouter) {
        if (ngDevMode) {
          console.warn(
            '[OverlayRouter] `syncUrl` is enabled but no Angular Router is available. URL sync is disabled.',
          );
        }

        syncUrl = false;

        return;
      }

      router = angularRouter;
      route = injectRoute();

      const currentRouteQueryParam = injectQueryParam(id);

      updateBrowserUrl(syncCurrentRoute());

      let isFirstRouteEvent = true;

      effect(() => {
        const r = currentRouteQueryParam();

        untracked(() => {
          if (isFirstRouteEvent) {
            isFirstRouteEvent = false;

            return;
          }

          // The user navigated back or forward using the browser history
          if (!r) {
            // The route query param no longer exists - close the overlay
            overlayRef.close();
          } else if (r !== syncCurrentRoute()) {
            const navStack = nativeBrowserBackStack();
            const curr = syncCurrentRoute();

            // An empty nav stack means the only way to have got here is back.
            const isForward = navStack.length > 0 && r === navStack[navStack.length - 1];
            const nextStack = !navStack.length ? [curr] : isForward ? navStack.slice(0, -1) : [...navStack, curr];

            const resolvedRoute = resolvePath(r);

            whenAllowed({
              from: curr,
              to: resolvedRoute.route,
              allowed: () => {
                commitNavigation({
                  resolvedRoute,
                  from: curr,
                  navigateConfig: { navigationDirection: isForward ? 'forward' : 'backward' },
                });
                nativeBrowserBackStack.set(nextStack);
              },
              // The browser already moved, so a veto has to put the param back or the URL names a
              // route that is not being rendered.
              blocked: () => updateBrowserUrl(curr),
            });
          } else {
            // The navigation was triggered by ui interaction. Clear the back nav stack.
            nativeBrowserBackStack.set([]);
          }
        });
      });
    };

    if (syncUrl) {
      setupUrlSync();
    }

    inject(DestroyRef).onDestroy(() => {
      if (syncUrl) {
        // Remove the dialog route from the browser url
        updateBrowserUrl(undefined);
      }
    });

    return {
      currentRoute,
      extraRoutes,
      transitionType,
      navigationDirection,
      canGoBack,
      navigationPending,
      routes,
      currentPage,
      navigate,
      registerNavigationGuard,
      back,
      resolvePath,
      addRoute,
      removeRoute,
      updateCurrentRoute,
      navigateToInitialRoute,
    };
  },
  { name: 'OverlayRouter' },
);

export const provideOverlayRouterService = /* @__PURE__ */ toProvideFn(OVERLAY_ROUTER_DEF);
export const injectOverlayRouter = /* @__PURE__ */ toInjectFn(OVERLAY_ROUTER_DEF);
export const OVERLAY_ROUTER_TOKEN = /* @__PURE__ */ toToken(OVERLAY_ROUTER_DEF);

export const provideOverlayRouterConfig = (config: OverlayRouterConfig): Provider[] => {
  return [
    {
      provide: OVERLAY_ROUTER_CONFIG_TOKEN,
      useValue: config,
    },
  ];
};

/**
 * Provides both the overlay router config and the overlay router itself, so a consumer only needs
 * a single entry in the overlay's `providers` instead of wiring the router separately.
 *
 * @example
 * overlayManager.open(MyOverlay, {
 *   strategies: dialogOverlayStrategy(),
 *   providers: [provideOverlayRouter({ routes: [...] })],
 * });
 */
export const provideOverlayRouter = (config: OverlayRouterConfig): Provider[] => {
  return [...provideOverlayRouterConfig(config), ...provideOverlayRouterService()];
};
