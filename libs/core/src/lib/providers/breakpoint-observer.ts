import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, makeEnvironmentProviders } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { createProvider, createStaticProvider } from '../utils';

export type Vec2 = [number, number];

export interface ViewportConfig {
  breakpoints: {
    xs: Vec2;
    sm: Vec2;
    md: Vec2;
    lg: Vec2;
    xl: Vec2;
    '2xl': Vec2;
  };
}

export type Breakpoint = keyof ViewportConfig['breakpoints'];

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

const [provideViewportConfig, injectViewportConfig] = createStaticProvider<ViewportConfig>(DEFAULT_VIEWPORT_CONFIG, {
  name: 'Viewport Config',
});

export type BuildMediaQueryOptions = {
  min?: number | Breakpoint;
  max?: number | Breakpoint;
};

const [internalProvideBreakpointObserver, injectBreakpointObserver] = createProvider(
  () => {
    const breakpointObserver = inject(BreakpointObserver);
    const viewportConfig = injectViewportConfig();

    const isMediaQueryMatched = (mediaQuery: string) => breakpointObserver.isMatched(mediaQuery);

    const observeMediaQuery = (mediaQuery: string) => {
      return toSignal(
        breakpointObserver.observe(mediaQuery).pipe(
          map((x) => x.matches),
          startWith(isMediaQueryMatched(mediaQuery)),
        ),
        { requireSync: true },
      );
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
      if (!options.min && !options.max) {
        throw new Error('At least one of min or max must be defined');
      }

      const mediaQueryParts: string[] = [];

      if (options.min) {
        if (typeof options.min === 'number') {
          mediaQueryParts.push(`(min-width: ${options.min}px)`);
        } else {
          mediaQueryParts.push(`(min-width: ${getBreakpointSize(options.min, 'min')}px)`);
        }
      }

      if (options.min && options.max) {
        mediaQueryParts.push('and');
      }

      if (options.max) {
        if (typeof options.max === 'number') {
          mediaQueryParts.push(`(max-width: ${options.max}px)`);
        } else {
          mediaQueryParts.push(`(max-width: ${getBreakpointSize(options.max, 'max')}px)`);
        }
      }

      return mediaQueryParts.join(' ');
    };

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

export const provideBreakpointObserver = (viewportConfig?: ViewportConfig) =>
  makeEnvironmentProviders([provideViewportConfig(viewportConfig), internalProvideBreakpointObserver()]);

export { injectBreakpointObserver, injectViewportConfig };
