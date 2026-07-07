import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationSkipped, Router } from '@angular/router';
import { filter } from 'rxjs';
import { createRoute, createRouterState } from '../router';

export type SetupScrollRestorationConfig = {
  /**
   * The scrollable container.
   * @default document.documentElement
   */
  scrollElement?: HTMLElement;
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

export const setupScrollRestoration = (config: SetupScrollRestorationConfig = {}) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const router = inject(Router);
  const document = inject(DOCUMENT);

  let prev = { state: createRouterState(router), route: createRoute(router) };

  router.events
    .pipe(
      filter(
        (e): e is NavigationEnd | NavigationSkipped => e instanceof NavigationEnd || e instanceof NavigationSkipped,
      ),
      takeUntilDestroyed(),
    )
    .subscribe(() => {
      const curr = { state: createRouterState(router), route: createRoute(router) };

      const prevState = prev.state;
      const currState = curr.state;
      const sameUrlNavigation = prev.route === curr.route;
      const didFragmentChange = prevState.fragment !== currState.fragment;

      prev = curr;

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
          (config.scrollElement ?? document.documentElement).scrollTop = 0;
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

        const el = config.scrollElement ?? document.documentElement;
        el.scrollTop = 0;
      }
    });
};
