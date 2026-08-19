import { DOCUMENT, DestroyRef, Signal, inject, signal } from '@angular/core';
import { defineRootProvider, defineStaticRootProvider, toInjectFn, toProvideFn } from '../utils';

export type Vec2 = [number, number];

export type ViewportConfig = {
  breakpoints: {
    xs: Vec2;
    sm: Vec2;
    md: Vec2;
    lg: Vec2;
    xl: Vec2;
    '2xl': Vec2;
  };
};

export type Breakpoint = keyof ViewportConfig['breakpoints'];

export const BREAKPOINT_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

/**
 * Default viewport config based on Tailwind CSS.
 * @see https://tailwindcss.com/docs/screens
 */
export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  breakpoints: {
    xs: [0, 639],
    sm: [640, 767],
    md: [768, 1023],
    lg: [1024, 1279],
    xl: [1280, 1535],
    '2xl': [1536, Infinity],
  },
};

const VIEWPORT_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<ViewportConfig>(DEFAULT_VIEWPORT_CONFIG, {
  name: 'Viewport Config',
});

export const provideViewportConfig = /* @__PURE__ */ toProvideFn(VIEWPORT_CONFIG_DEF);
export const injectViewportConfig = /* @__PURE__ */ toInjectFn(VIEWPORT_CONFIG_DEF);

export type BuildMediaQueryOptions = {
  min?: number | Breakpoint;
  max?: number | Breakpoint;
};

const BREAKPOINT_OBSERVER_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const viewportConfig = injectViewportConfig();
    const destroyRef = inject(DestroyRef);
    const defaultView = inject(DOCUMENT).defaultView;
    const matchMedia = defaultView?.matchMedia?.bind(defaultView) ?? null;
    const queryLists = new Map<string, MediaQueryList>();
    const querySignals = new Map<string, Signal<boolean>>();
    const queryListenerCleanups = new Map<string, () => void>();

    const getQueryList = (mediaQuery: string) => {
      if (!matchMedia) return null;

      let queryList = queryLists.get(mediaQuery);

      if (!queryList) {
        queryList = matchMedia(mediaQuery);
        queryLists.set(mediaQuery, queryList);
      }

      return queryList;
    };

    const isMediaQueryMatched = (mediaQuery: string) => getQueryList(mediaQuery)?.matches ?? false;

    const observeMediaQuery = (mediaQuery: string): Signal<boolean> => {
      const existing = querySignals.get(mediaQuery);

      if (existing) return existing;

      const queryList = getQueryList(mediaQuery);
      const matches = signal(queryList?.matches ?? false);

      if (queryList) {
        const onChange = (event: MediaQueryListEvent) => matches.set(event.matches);
        queryList.addEventListener('change', onChange);
        queryListenerCleanups.set(mediaQuery, () => queryList.removeEventListener('change', onChange));
      }

      const result = matches.asReadonly();
      querySignals.set(mediaQuery, result);

      return result;
    };

    const observeBreakpoint = (options: BuildMediaQueryOptions) => observeMediaQuery(buildMediaQueryString(options));

    const isBreakpointMatched = (options: BuildMediaQueryOptions) =>
      isMediaQueryMatched(buildMediaQueryString(options));

    const getBreakpointSize = (type: Breakpoint, option: 'min' | 'max') => {
      const index = option === 'min' ? 0 : 1;
      const size = viewportConfig.breakpoints[type][index];

      if (size === Infinity || size === 0) {
        return size;
      }

      if (option === 'min') {
        return size;
      }

      // Due to scaling, the actual size of the viewport may be a decimal number.
      // Eg. on Windows 11 with 150% scaling, the viewport size may be 1535.33px
      // and thus not matching any of the default breakpoints.
      return size + 0.9;
    };

    const buildMediaQueryString = (options: BuildMediaQueryOptions) => {
      if (options.min === undefined && options.max === undefined) {
        throw new Error('At least one of min or max must be defined');
      }

      const mediaQueryParts: string[] = [];

      if (options.min !== undefined) {
        if (typeof options.min === 'number') {
          mediaQueryParts.push(`(min-width: ${options.min}px)`);
        } else {
          mediaQueryParts.push(`(min-width: ${getBreakpointSize(options.min, 'min')}px)`);
        }
      }

      if (options.max !== undefined) {
        const max = typeof options.max === 'number' ? options.max : getBreakpointSize(options.max, 'max');
        if (max !== Infinity) mediaQueryParts.push(`(max-width: ${max}px)`);
      }

      return mediaQueryParts.length > 0 ? mediaQueryParts.join(' and ') : '(min-width: 0px)';
    };

    destroyRef.onDestroy(() => {
      queryListenerCleanups.forEach((cleanup) => cleanup());
    });

    return {
      observeBreakpoint,
      isBreakpointMatched,
      getBreakpointSize,
      buildMediaQueryString,
      observeMediaQuery,
      isMediaQueryMatched,
    };
  },
  { name: 'Breakpoint Observer' },
);

export const provideBreakpointObserver = /* @__PURE__ */ toProvideFn(BREAKPOINT_OBSERVER_DEF);
export const injectBreakpointObserver = /* @__PURE__ */ toInjectFn(BREAKPOINT_OBSERVER_DEF);
