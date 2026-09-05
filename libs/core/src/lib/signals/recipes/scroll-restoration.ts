import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, DestroyRef, DOCUMENT, inject, Injector, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationSkipped, NavigationStart, Params, Router } from '@angular/router';
import { filter } from 'rxjs';
import { defineRootProvider, toInjectFn } from '../../utils';
import { createRoute, createRouterState } from '../router';

/**
 * The element that gets scrolled. Pass a function if the scroll container is created per route or
 * only exists after the app shell rendered - it is resolved on every navigation instead of once at
 * setup time.
 * @default document.documentElement
 */
export type ScrollRestorationScrollElement = HTMLElement | (() => HTMLElement | null | undefined);

export type ScrollRestorationRestoreConfig = {
  /**
   * Restore the previous scroll offset when the user navigates back or forward through the browser
   * history, instead of scrolling to top.
   *
   * The offset is not applied on the loading frame: query driven pages render skeletons/empty states
   * first, so the document is far shorter than it was when the user left. Restoration waits until
   * the content is tall enough to actually reach the saved offset (see `timeout`).
   * @default false
   */
  enabled?: boolean;

  /**
   * How long to keep waiting (in ms) for the content to grow tall enough to reach the saved offset.
   * The clock is suspended while a {@link holdScrollRestoration} registration reads `true`.
   * @default 1000
   */
  timeout?: number;

  /**
   * Absolute upper bound (in ms) for a single restoration attempt, regardless of
   * {@link holdScrollRestoration} registrations. Guards against a page that never stops loading.
   * @default 10000
   */
  maxTimeout?: number;

  /**
   * Whether to apply the saved offset clamped to the reachable maximum once `timeout` elapsed
   * without the content getting tall enough. Landing close to the previous position is usually
   * better than staying at the top.
   * @default true
   */
  clampOnTimeout?: boolean;
};

export type SetupScrollRestorationConfig = {
  /**
   * The scrollable container.
   * @default document.documentElement
   */
  scrollElement?: ScrollRestorationScrollElement;
  /**
   * A list of query params that should trigger a scroll to top.
   * @default []
   * @example ['page'] // will scroll to top when the page query param changes
   */
  queryParamTriggerList?: string[];
  /**
   * Config for fragment scrolling.
   */
  fragment?: {
    /**
     * Enable fragment scrolling (scroll to element with id)
     * @default false
     */
    enabled?: boolean;
    /**
     * Whether to use smooth scrolling or not.
     * @default false
     */
    smooth?: boolean;
  };
  /**
   * Config for restoring the previous scroll offset on browser back/forward navigation.
   * Disabled by default - without it, history navigation scrolls to top like any other navigation.
   */
  restore?: ScrollRestorationRestoreConfig;
};

export const ET_DISABLE_SCROLL_TOP = /* @__PURE__ */ Symbol('ET_DISABLE_SCROLL_TOP');
export const ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE = /* @__PURE__ */ Symbol('ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE');
export const ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE = /* @__PURE__ */ Symbol(
  'ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE',
);

export type RouterDisableScrollTopConfig = {
  /**
   * Whether to disable scroll to top ONLY when navigating back to this route.
   * @default false
   */
  asReturnRoute?: boolean;

  /**
   * Whether to disable scroll to top when a path param changes.
   * @default false
   */
  onPathParamChange?: boolean;
};

export const routerDisableScrollTop = (config: RouterDisableScrollTopConfig = {}) => {
  return {
    ...(!config.asReturnRoute ? { [ET_DISABLE_SCROLL_TOP]: true } : { [ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE]: true }),
    ...(config.onPathParamChange ? { [ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE]: true } : {}),
  };
};

export const ET_RESTORE_SCROLL = /* @__PURE__ */ Symbol('ET_RESTORE_SCROLL');

/**
 * Marks a navigation as a return to a page the user has already seen, so it restores that page's last
 * scroll offset instead of scrolling to top - what a "back to the overview" link means, as opposed to
 * a link that opens the overview fresh. Spread into `NavigationExtras.state`; for a `routerLink`, use
 * {@link RestoreScrollDirective} instead.
 *
 * Needs `restore.enabled` on {@link setupScrollRestoration}, and only ever restores an offset the
 * session actually recorded - the first visit to a page has none, so it scrolls to top as usual.
 *
 * @example
 * router.navigate(['/teams'], { state: routerRestoreScroll() });
 */
export const routerRestoreScroll = () => ({ [ET_RESTORE_SCROLL]: true });

const SCROLL_RESTORATION_HOLDS_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const holds = new Set<() => boolean>();

    return {
      add: (isPending: () => boolean) => {
        holds.add(isPending);

        return () => holds.delete(isPending);
      },
      isHeld: () => {
        for (const isPending of holds) {
          if (isPending()) return true;
        }

        return false;
      },
    };
  },
  { name: 'ScrollRestorationHolds' },
);

/**
 * Registry of "not settled yet" reporters. Lives in the root injector so a route component can
 * reach the registration created by the app level `setupScrollRestoration` call.
 * @internal
 */
const injectScrollRestorationHolds = /* @__PURE__ */ toInjectFn(SCROLL_RESTORATION_HOLDS_DEF);

/**
 * Suspend scroll restoration while `isPending` reads `true`.
 *
 * Restoration already waits for the scroll container to grow tall enough to reach the saved offset,
 * so this is only needed when the content may take longer than `restore.timeout` to get there -
 * a slow list request, for instance. Registers for the lifetime of the current injection context.
 *
 * @example
 * // inside a route component
 * holdScrollRestoration(() => query.isLoading());
 */
export const holdScrollRestoration = (isPending: () => boolean) => {
  const remove = injectScrollRestorationHolds().add(isPending);

  inject(DestroyRef).onDestroy(remove);
};

/** Upper bound on remembered history entries. Each entry is a single number, so this is generous. */
const MAX_STORED_POSITIONS = 200;

const DEFAULT_RESTORE_TIMEOUT = 1000;
const DEFAULT_RESTORE_MAX_TIMEOUT = 10_000;

/** Events that mean the user took over scrolling, so a pending restoration must be abandoned. */
const INTERACTION_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;

/** What a visited history entry left behind: where it was scrolled to, and which page that was. */
type StoredPosition = {
  top: number;
  route: string;
  search: string;
};

/** Key order is navigation order, not declaration order, so two spellings of one URL compare equal. */
const serializeQueryParams = (queryParams: Params) =>
  Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

// Two navigations that matched the same route definition get the same object back, which is what
// tells `/detail/1` -> `/detail/2` apart from `/list` -> `/detail/1`.
const getDeepestRouteConfig = (router: Router) => {
  let route = router.routerState.snapshot.root;

  while (route.firstChild) {
    route = route.firstChild;
  }

  return route.routeConfig;
};

const didPathParamsChange = (prevParams: Params, currParams: Params) =>
  [...new Set(Object.keys(prevParams).concat(Object.keys(currParams)))].some(
    (key) => prevParams[key] !== currParams[key],
  );

export const setupScrollRestoration = (config: SetupScrollRestorationConfig = {}) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const router = inject(Router);
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const holds = injectScrollRestorationHolds();

  const restoreEnabled = config.restore?.enabled === true;
  const restoreTimeout = config.restore?.timeout ?? DEFAULT_RESTORE_TIMEOUT;
  const restoreMaxTimeout = config.restore?.maxTimeout ?? DEFAULT_RESTORE_MAX_TIMEOUT;
  const clampOnTimeout = config.restore?.clampOnTimeout ?? true;

  const resolveScrollElement = () => {
    const el = typeof config.scrollElement === 'function' ? config.scrollElement() : config.scrollElement;

    return el ?? document.documentElement;
  };

  // The browser restores the offset against the still-loading (much shorter) document, which is the
  // exact problem we are solving - take it over completely.
  const previousScrollRestoration = 'scrollRestoration' in history ? history.scrollRestoration : null;
  if (restoreEnabled && previousScrollRestoration !== null) {
    history.scrollRestoration = 'manual';
  }

  /** Saved offsets keyed by the router's per-history-entry `navigationId`, in least-recent-first order. */
  const positions = new Map<number, StoredPosition>();

  // Mirrors Angular's own `RouterScroller`: the offset of the currently displayed page belongs to
  // the navigation that produced it, and a popstate reports the id of the entry it moves to.
  let lastNavigationId: number | null = null;
  let restoredNavigationId: number | null = null;
  let isPopstate = false;
  let wantsRestore = false;

  let prev = {
    state: createRouterState(router),
    route: createRoute(router),
    routeConfig: getDeepestRouteConfig(router),
  };

  let pendingRestore: (() => void) | null = null;

  const cancelPendingRestore = () => {
    pendingRestore?.();
    pendingRestore = null;
  };

  const scheduleRestore = (target: number) => {
    cancelPendingRestore();

    let frame = 0;
    let started = false;
    let cancelled = false;

    // The user scrolling always wins over a restoration we have not committed yet.
    const abortByUser = () => cancelPendingRestore();

    const hardDeadline = Date.now() + restoreMaxTimeout;
    let deadline = Date.now() + restoreTimeout;

    const step = () => {
      frame = 0;

      if (cancelled) return;

      const el = resolveScrollElement();
      const maxOffset = Math.max(0, el.scrollHeight - el.clientHeight);

      if (maxOffset >= target) {
        el.scrollTop = target;
        cancelPendingRestore();

        return;
      }

      const now = Date.now();

      // A registered hold means the page knows more data is coming, so the content is expected to
      // grow - suspend the clock instead of giving up on a still loading page.
      if (holds.isHeld() && now < hardDeadline) {
        deadline = now + restoreTimeout;
      }

      if (now < deadline && now < hardDeadline) {
        frame = requestAnimationFrame(step);

        return;
      }

      if (clampOnTimeout && maxOffset > 0) {
        el.scrollTop = Math.min(target, maxOffset);
      }

      cancelPendingRestore();
    };

    // Wait for the new route to actually render before reading any geometry - on `NavigationEnd` the
    // components exist but the DOM still shows the previous page, whose height would be measured
    // instead. The timeout is a safety net in case no render pass follows.
    const start = () => {
      if (started || cancelled) return;
      started = true;

      frame = requestAnimationFrame(step);
    };

    const renderRef = afterNextRender({ read: start }, { injector });

    const fallback = setTimeout(start);

    for (const eventName of INTERACTION_EVENTS) {
      document.addEventListener(eventName, abortByUser, { capture: true, passive: true });
    }

    pendingRestore = () => {
      // `cancelled` is not redundant with destroying the render hook: a superseded restoration must
      // not apply its (now stale) offset even if its hook had already been queued to run.
      cancelled = true;
      renderRef.destroy();

      if (frame) cancelAnimationFrame(frame);
      clearTimeout(fallback);

      for (const eventName of INTERACTION_EVENTS) {
        document.removeEventListener(eventName, abortByUser, { capture: true });
      }
    };
  };

  /**
   * The offset the most recently left entry for this page had. A target without query params means
   * "that page", whichever query state it was last in - the crumb linking to an overview does not
   * know, and should not have to reproduce, the filter the user left it under.
   */
  const findLastVisitedOffset = (route: string, search: string) => {
    const entries = [...positions.values()];

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];

      if (!entry || entry.route !== route) continue;
      if (search && entry.search !== search) continue;

      return entry.top;
    }

    return undefined;
  };

  const onNavigationStart = (event: NavigationStart) => {
    // A new navigation supersedes a restoration that has not committed yet.
    cancelPendingRestore();

    if (!restoreEnabled) return;

    // Re-inserted rather than overwritten so map order stays least-recently-left first, which is both
    // what `findLastVisitedOffset` walks backwards and what the cap below evicts from.
    if (lastNavigationId !== null) {
      positions.delete(lastNavigationId);
      positions.set(lastNavigationId, {
        top: resolveScrollElement().scrollTop,
        route: prev.route,
        search: serializeQueryParams(prev.state.queryParams),
      });
    }

    if (positions.size > MAX_STORED_POSITIONS) {
      const oldest = positions.keys().next();

      if (!oldest.done) positions.delete(oldest.value);
    }

    isPopstate = event.navigationTrigger === 'popstate';
    restoredNavigationId = event.restoredState?.navigationId ?? null;

    // Read off the navigation rather than `history.state`: a symbol key does not survive being
    // structured-cloned into the history entry, which is what keeps the mark from outliving this
    // navigation and re-firing when the user later pops back to the entry it created.
    const navigationState = router.getCurrentNavigation()?.extras.state as Record<symbol, unknown> | undefined;

    wantsRestore = !isPopstate && navigationState?.[ET_RESTORE_SCROLL] === true;
  };

  const onNavigationEnd = (event: NavigationEnd | NavigationSkipped) => {
    const curr = {
      state: createRouterState(router),
      route: createRoute(router),
      routeConfig: getDeepestRouteConfig(router),
    };

    const prevState = prev.state;
    const currState = curr.state;
    const sameRouteConfig = prev.routeConfig !== null && prev.routeConfig === curr.routeConfig;
    const sameUrlNavigation = prev.route === curr.route;
    const didFragmentChange = prevState.fragment !== currState.fragment;

    prev = curr;

    const wasMarkedAsReturn = wantsRestore;

    wantsRestore = false;

    if (event instanceof NavigationEnd) {
      lastNavigationId = event.id;
    } else {
      // A skipped same url navigation is not a history move, so there is nothing to restore.
      isPopstate = false;
      restoredNavigationId = null;
    }

    if (restoreEnabled && isPopstate) {
      const target = restoredNavigationId === null ? undefined : positions.get(restoredNavigationId);

      // The saved offset wins over both scroll to top and fragment scrolling: the user may well have
      // scrolled away from the anchor before leaving the page.
      if (target !== undefined) {
        scheduleRestore(target.top);

        return;
      }
    }

    if (restoreEnabled && wasMarkedAsReturn) {
      const target = findLastVisitedOffset(curr.route, serializeQueryParams(currState.queryParams));

      if (target !== undefined) {
        scheduleRestore(target);

        return;
      }
    }

    if (sameUrlNavigation) {
      const allQueryParams = [
        ...new Set(Object.keys(prevState.queryParams).concat(Object.keys(currState.queryParams))),
      ];

      const changedQueryParams = allQueryParams.filter(
        (key) => currState.queryParams[key] !== prevState.queryParams[key],
      );

      if (!config.queryParamTriggerList?.length && !didFragmentChange) {
        return;
      }

      const caseQueryParams = changedQueryParams.some((key) => config.queryParamTriggerList?.includes(key));
      const caseFragment = didFragmentChange && config.fragment?.enabled;

      if (caseQueryParams) {
        resolveScrollElement().scrollTop = 0;
      } else if (caseFragment) {
        const fragmentElement = document.getElementById(currState.fragment ?? '');

        if (fragmentElement) {
          fragmentElement.scrollIntoView({ behavior: config.fragment?.smooth ? 'smooth' : 'auto' });
        }
      }
    } else {
      const viaReturnRoute =
        currState.data[ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE] && prevState.data[ET_DISABLE_SCROLL_TOP];
      const explicitly = currState.data[ET_DISABLE_SCROLL_TOP];
      const pathParamsChange =
        currState.data[ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE] &&
        sameRouteConfig &&
        didPathParamsChange(prevState.pathParams, currState.pathParams);

      if (viaReturnRoute || explicitly || pathParamsChange) {
        return;
      }

      resolveScrollElement().scrollTop = 0;
    }
  };

  router.events
    .pipe(
      filter(
        (e): e is NavigationStart | NavigationEnd | NavigationSkipped =>
          e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationSkipped,
      ),
      takeUntilDestroyed(),
    )
    .subscribe((event) => {
      if (event instanceof NavigationStart) {
        onNavigationStart(event);

        return;
      }

      onNavigationEnd(event);
    });

  destroyRef.onDestroy(() => {
    cancelPendingRestore();
    if (restoreEnabled && previousScrollRestoration !== null) {
      history.scrollRestoration = previousScrollRestoration;
    }
  });
};
