import { inject, InjectionToken } from '@angular/core';

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

export const VIEWPORT_CONFIG = new InjectionToken<ViewportConfig>('ViewportConfig');

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

export const provideViewportConfig = (viewportConfig: ViewportConfig) => {
  return { provide: VIEWPORT_CONFIG, useValue: viewportConfig };
};

export const injectViewportConfig = () => inject(VIEWPORT_CONFIG);

export const getBreakpointSize = (type: Breakpoint, option: 'min' | 'max') => {
  const index = option === 'min' ? 0 : 1;
  const size = injectViewportConfig().breakpoints[type][index];

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
