import {
  computed,
  DestroyRef,
  DOCUMENT,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  Signal,
  signal,
} from '@angular/core';
import { injectBreakpointObserver } from '../providers/breakpoint-observer';
import { defineProvider, toInjectFn, toProvideFn } from '../utils';
import { injectSurfaceThemes, injectSurfaceThemesPrefix, SurfaceTheme, SurfaceType } from './surface-theme.util';

export type ColorSchemeMode = SurfaceType | 'system';

export type ColorSchemeConfig = {
  /** The mode the app starts in. Defaults to `'system'`. */
  mode?: ColorSchemeMode;
};

const COLOR_SCHEME_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const root = inject(DOCUMENT).documentElement;
    const prefix = injectSurfaceThemesPrefix({ optional: true }) || 'et';
    const prefersDark = injectBreakpointObserver().observeMediaQuery('(prefers-color-scheme: dark)');
    const mode = signal<ColorSchemeMode>('system');

    const type = computed<SurfaceType>(() => {
      const current = mode();

      if (current !== 'system') return current;

      return prefersDark() ? 'dark' : 'light';
    });

    const clearClasses = () => root.classList.remove(`${prefix}-scheme--light`, `${prefix}-scheme--dark`);

    const setMode = (next: ColorSchemeMode) => {
      clearClasses();

      if (next !== 'system') root.classList.add(`${prefix}-scheme--${next}`);

      mode.set(next);
    };

    inject(DestroyRef).onDestroy(clearClasses);

    return { mode: mode.asReadonly(), type, setMode };
  },
  { name: 'Color Scheme' },
);

const provideColorSchemeState = /* @__PURE__ */ toProvideFn(COLOR_SCHEME_DEF);

/**
 * Inject the app's color scheme: `mode()` is what the app asked for, `type()` the surface type the
 * root paints, and `setMode()` switches it. Needs `provideColorScheme()`.
 */
export const injectColorScheme = /* @__PURE__ */ toInjectFn(COLOR_SCHEME_DEF);

/**
 * Lets the app switch between its default light and dark surface with a class on `<html>`, instead of
 * only following `prefers-color-scheme`. Add it to the application config, next to
 * `provideSurfaceThemesWithTailwind4()`.
 */
export const provideColorScheme = (config?: ColorSchemeConfig): EnvironmentProviders =>
  makeEnvironmentProviders([
    provideColorSchemeState(),
    provideEnvironmentInitializer(() => injectColorScheme().setMode(config?.mode ?? 'system')),
  ]);

/**
 * Inject a signal of the default surface theme the root paints where nothing scopes one. If the app
 * registers a default for both surface types, it follows `injectColorScheme()`, and is `null` without
 * `provideColorScheme()`.
 */
export const injectRootSurfaceTheme = (): Signal<SurfaceTheme | null> => {
  const defaults = injectSurfaceThemes({ optional: true })?.filter((theme) => theme.isDefault) ?? [];
  const colorScheme = injectColorScheme({ optional: true });

  return computed(() => {
    if (defaults.length <= 1) return defaults[0] ?? null;

    const type = colorScheme?.type();

    return defaults.find((theme) => theme.type === type) ?? null;
  });
};
