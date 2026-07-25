import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, DestroyRef, DOCUMENT, inject, Injector, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { createRootProvider } from '../../utils';
import { createRoute, createRouterState } from '../router';

/**
 * The element that gets scrolled. Pass a function if the scroll container is created per route or
 * only exists after the app shell rendered — it is resolved on every navigation instead of once at
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
   * Disabled by default — without it, history navigation scrolls to top like any other navigation.
   */
  restore?: ScrollRestorationRestoreConfig;
};

export const ET_DISABLE_SCROLL_TOP = Symbol('ET_DISABLE_SCROLL_TOP');
export const ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE = Symbol('ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE');
export const ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE = Symbol('ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE');

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

/**
 * Registry of "not settled yet" reporters. Lives in the root injector so a route component can
 * reach the registration created by the app level `setupScrollRestoration` call.
 * @internal
 */
const [, injectScrollRestorationHolds] = createRootProvider(
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
 * Suspend scroll restoration while `isPending` reads `true`.
 *
 * Restoration already waits for the scroll container to grow tall enough to reach the saved offset,
 * so this is only needed when the content may take longer than `restore.timeout` to get there —
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

export const setupScrollRestoration = (config: SetupScrollRestorationConfig = {}) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const router = inject(Router);
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
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
  // exact problem we are solving — take it over completely.
  if (restoreEnabled && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  /** Saved offsets keyed by the router's per-history-entry `navigationId`. */
  const positions = new Map<number, number>();

  // Mirrors Angular's own `RouterScroller`: the offset of the currently displayed page belongs to
  // the navigation that produced it, and a popstate reports the id of the entry it moves to.
  let lastNavigationId = 0;
  let restoredNavigationId = 0;
  let isPopstate = false;

  let prev = { state: createRouterState(router), route: createRoute(router) };

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

    const hardDeadline = Date.now() + Math.max(restoreTimeout, restoreMaxTimeout);
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
      // grow — suspend the clock instead of giving up on a still loading page.
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

    // Wait for the new route to actually render before reading any geometry — on `NavigationEnd` the
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

  const onNavigationStart = (event: NavigationStart) => {
    // A new navigation supersedes a restoration that has not committed yet.
    cancelPendingRestore();

    if (!restoreEnabled) return;

    positions.set(lastNavigationId, resolveScrollElement().scrollTop);

    if (positions.size > MAX_STORED_POSITIONS) {
      const oldest = positions.keys().next();

      if (!oldest.done) positions.delete(oldest.value);
    }

    isPopstate = event.navigationTrigger === 'popstate';
    restoredNavigationId = event.restoredState?.navigationId ?? 0;
  };

  const onNavigationEnd = (event: NavigationEnd | NavigationSkipped) => {
    const curr = { state: createRouterState(router), route: createRoute(router) };

    const prevState = prev.state;
    const currState = curr.state;
    const sameUrlNavigation = prev.route === curr.route;
    const didFragmentChange = prevState.fragment !== currState.fragment;

    prev = curr;

    if (event instanceof NavigationEnd) {
      lastNavigationId = event.id;
    } else {
      // A skipped same url navigation is not a history move, so there is nothing to restore.
      isPopstate = false;
      restoredNavigationId = 0;
    }

    if (restoreEnabled && isPopstate) {
      const target = positions.get(restoredNavigationId);

      // The saved offset wins over both scroll to top and fragment scrolling: the user may well have
      // scrolled away from the anchor before leaving the page.
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
      const pathParamsChange = currState.data[ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE];

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
};
