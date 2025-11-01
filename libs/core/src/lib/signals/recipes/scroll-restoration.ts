import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, PLATFORM_ID } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, pairwise } from 'rxjs';
import { injectRoute, injectRouterState } from '../router';

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

const ET_DISABLE_SCROLL_TOP = Symbol('ET_DISABLE_SCROLL_TOP');
const ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE = Symbol('ET_DISABLE_SCROLL_TOP_AS_RETURN_ROUTE');
const ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE = Symbol('ET_DISABLE_SCROLL_TOP_ON_PATH_PARAM_CHANGE');

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

  const state = injectRouterState();
  const route = injectRoute();
  const document = inject(DOCUMENT);

  combineLatest([toObservable(state).pipe(pairwise()), toObservable(route).pipe(pairwise())])
    .pipe(debounceTime(1))
    .subscribe(([[prevState, currState], [prevRoute, currRoute]]) => {
      const sameUrlNavigation = prevRoute === currRoute;
      const didFragmentChange = prevState.fragment !== currState.fragment;

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
