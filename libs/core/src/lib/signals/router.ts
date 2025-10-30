import { isPlatformBrowser } from '@angular/common';
import {
  Injector,
  PLATFORM_ID,
  Signal,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Event, NavigationEnd, NavigationSkipped, Router } from '@angular/router';
import { ET_PROPERTY_REMOVED, RouterState } from '../services';
import { equal } from '../utils';
import { memoizeSignal, previousSignalValue } from './signal-data-utils';

export type InjectUtilConfig = {
  /** The injector to use for the injection. Must be provided if the function is not called from within a injection context. */
  injector?: Injector;
};

export type InjectUtilTransformConfig<In, Out> = {
  /**
   * A transform function similar to the `transform` function in Angular input bindings.
   * Can be used to transform the value before it is returned.
   * E.g. transforming `"true"` to `true` for a boolean attribute.
   */
  transform?: (value: In) => Out;
};

export const transformOrReturn = <In, Out>(src: Signal<In>, config?: InjectUtilTransformConfig<In, Out>) => {
  const transformer = config?.transform;

  if (transformer) {
    return computed(() => transformer(src()));
  }

  return src as unknown as Signal<Out>;
};

const createInitialRoute = () => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const router = inject(Router);

  if (!isBrowser) {
    return router.url;
  }

  return window.location.pathname + window.location.search + window.location.hash;
};

/** Inject the current router event */
export const injectRouterEvent = memoizeSignal(() => {
  const router = inject(Router);

  const initialRoute = createInitialRoute();

  return toSignal(router.events, {
    initialValue: new NavigationEnd(-1, initialRoute, initialRoute),
  });
});

/**
 * Inject the current url.
 * The url includes query params as well as the fragment. Use `injectRoute` instead if you are not intrusted in those.
 * @example "/my-page?query=1&param=true#fragment"
 */
export const injectUrl = memoizeSignal(() => {
  const event = injectRouterEvent();

  return linkedSignal<Event | null, string>({
    source: event,
    computation: (curr, prev) => {
      if (curr instanceof NavigationEnd) {
        return curr.urlAfterRedirects;
      } else if (curr instanceof NavigationSkipped) {
        return curr.url;
      } else if (prev?.value) {
        return prev.value;
      }

      return createInitialRoute();
    },
  }).asReadonly();
});

/**
 * Inject the current route
 * @example "/my-page"
 */
export const injectRoute = memoizeSignal(() => {
  const url = injectUrl();

  return computed(() => {
    const fullUrl = url();
    const urlWithoutQueryParams = fullUrl.split('?')[0] ?? '';
    const withoutFragment = urlWithoutQueryParams.split('#')[0] ?? '';

    return withoutFragment;
  });
});

const createRouterState = (router: Router) => {
  let route = router.routerState.snapshot.root;

  while (route.firstChild) {
    route = route.firstChild;
  }

  const { data, params, queryParams, title, fragment } = route;

  return {
    data,
    pathParams: params,
    queryParams,
    title: title ?? null,
    fragment,
  };
};

/**
 * Inject the complete router state. This includes the current route data, path params, query params, title and fragment.
 */
export const injectRouterState = memoizeSignal(() => {
  const event = injectRouterEvent();
  const router = inject(Router);

  const routerState = signal<RouterState>(createRouterState(router));

  effect(() => {
    const e = event();

    untracked(() => {
      if (e instanceof NavigationEnd && e.id === -1) {
        return;
      } else {
        routerState.set(createRouterState(router));
      }
    });
  });

  return computed(() => routerState(), { equal });
});

/** Inject a signal containing the current route fragment (the part after the # inside the url if present) */
export const injectFragment = <T = string | null>(
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  const routerState = injectRouterState();
  const fragment = computed(() => routerState().fragment);

  return transformOrReturn(fragment, config);
};

/** Inject all currently available query parameters as a signal */
export const injectQueryParams = () => {
  const routerState = injectRouterState();

  const queryParams = computed(() => routerState().queryParams);

  return queryParams;
};

/** Inject all currently available route data as a signal */
export const injectRouteData = () => {
  const routerState = injectRouterState();

  const data = computed(() => routerState().data);

  return data;
};

/** Inject the current route title as a signal */
export const injectRouteTitle = <T = string | null>(config?: InjectUtilTransformConfig<string | null, T>) => {
  const routerState = injectRouterState();
  const title = computed(() => routerState().title);

  return transformOrReturn(title, config);
};

/** Inject all currently available path parameters as a signal */
export const injectPathParams = () => {
  const routerState = injectRouterState();

  const pathParams = computed(() => routerState().pathParams);

  return pathParams;
};

export type InjectQueryParamConfig<T> = InjectUtilTransformConfig<string | null, T> & {
  /**
   * If true, the initial value will be read from the browser's url.
   * Note that this will not work with arrays or complex objects.
   */
  requireSync?: boolean;
};

const getQueryParamFromUrl = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

/** Inject a specific query parameter as a signal */
export const injectQueryParam = <T = string | null>(key: string, config?: InjectQueryParamConfig<T>) => {
  const queryParams = injectQueryParams();
  const src = computed(() => queryParams()[key] ?? (config?.requireSync ? getQueryParamFromUrl(key) : null)) as Signal<
    string | null
  >;

  return transformOrReturn(src, config);
};

/** Inject a specific route data item as a signal */
export const injectRouteDataItem = <T = unknown>(key: string, config?: InjectUtilTransformConfig<unknown, T>) => {
  const data = injectRouteData();
  const src = computed(() => data()[key] ?? null) as Signal<T>;

  return transformOrReturn(src, config);
};

/** Inject a specific path parameter as a signal */
export const injectPathParam = <T = string | null>(
  key: string,
  config?: InjectUtilTransformConfig<string | null, T>,
) => {
  const pathParams = injectPathParams();
  const src = computed(() => pathParams()[key] ?? null) as Signal<string | null>;

  return transformOrReturn(src, config);
};

/**
 * Inject query params that changed during navigation. Unchanged query params will be ignored.
 * Removed query params will be represented by the symbol `ET_PROPERTY_REMOVED`.
 */
export const injectQueryParamChanges = memoizeSignal(() => {
  const queryParams = injectQueryParams();
  const prevQueryParams = previousSignalValue(queryParams);

  return computed(() => {
    const current = queryParams();
    const previous = prevQueryParams() ?? {};

    const changes: Record<string, unknown> = {};

    const allKeys = new Set<keyof typeof previous & keyof typeof current>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      if (!equal(previous[key], current[key])) {
        const val = current[key] === undefined ? ET_PROPERTY_REMOVED : current[key];

        changes[key] = val;
      }
    }

    return changes;
  });
});

/**
 * Inject path params that changed during navigation. Unchanged path params will be ignored.
 * Removed path params will be represented by the symbol `ET_PROPERTY_REMOVED`.
 */
export const injectPathParamChanges = memoizeSignal(() => {
  const pathParams = injectPathParams();
  const prevPathParams = previousSignalValue(pathParams);

  return computed(() => {
    const current = pathParams();
    const previous = prevPathParams() ?? {};

    const changes: Record<string, unknown> = {};

    const allKeys = new Set<keyof typeof previous & keyof typeof current>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      if (!equal(previous[key], current[key])) {
        const val = current[key] === undefined ? ET_PROPERTY_REMOVED : current[key];

        changes[key] = val;
      }
    }

    return changes;
  });
});
