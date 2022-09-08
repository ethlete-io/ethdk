import { InjectionToken } from '@angular/core';
import { ViewportConfig } from '../types';

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
