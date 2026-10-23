import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  Signal,
  signal,
} from '@angular/core';
import { injectBreakpointObserver } from '../providers/breakpoint-observer';
import { defineProvider, toInjectFn, toProvideFn } from '../utils';
import { COLOR_SCHEME_TYPE } from './color-scheme-type.token';
import {
  createCssColorThemeName,
  injectColorThemes,
  injectColorThemesPrefix,
  resolveColorThemeVariant,
} from './color-theme.util';
import { injectSurfaceThemes, injectSurfaceThemesPrefix, SurfaceTheme, SurfaceType } from './surface-theme.util';

export type ColorSchemeMode = SurfaceType | 'system';

export type ColorSchemeConfig = {
  /** The mode the app starts in. Defaults to `'system'`. */
  mode?: ColorSchemeMode;
};

const findRootSurfaceTheme = (defaults: SurfaceTheme[], type: SurfaceType | undefined) => {
  if (defaults.length <= 1) return defaults[0] ?? null;

  return defaults.find((theme) => theme.type === type) ?? null;
};

const COLOR_SCHEME_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const root = inject(DOCUMENT).documentElement;
    const prefix = injectSurfaceThemesPrefix({ optional: true }) || 'et';
    const prefersDark = injectBreakpointObserver().observeMediaQuery('(prefers-color-scheme: dark)');
    const mode = signal<ColorSchemeMode>('system');
    const surfaceDefaults = injectSurfaceThemes({ optional: true })?.filter((theme) => theme.isDefault) ?? [];
    const colorThemes = injectColorThemes({ optional: true });
    const colorPrefix = injectColorThemesPrefix({ optional: true }) || 'et';

    const type = computed<SurfaceType>(() => {
      const current = mode();

      if (current !== 'system') return current;

      return prefersDark() ? 'dark' : 'light';
    });

    const rootSurface = computed(() => findRootSurfaceTheme(surfaceDefaults, type()));

    const rootColorClass = computed(() => {
      const chosen = colorThemes?.find((theme) => theme.isDefault)?.name;

      if (!chosen) return null;

      const variant = resolveColorThemeVariant(rootSurface(), chosen, colorThemes);

      return variant === chosen ? null : `${colorPrefix}-color--${createCssColorThemeName(variant)}`;
    });

    const defaultColor = colorThemes?.find((theme) => theme.isDefault)?.name;

    if (defaultColor) {
      for (const surface of surfaceDefaults) {
        const variant = resolveColorThemeVariant(surface, defaultColor, colorThemes);

        if (variant !== defaultColor)
          root.classList.remove(`${colorPrefix}-color--${createCssColorThemeName(variant)}`);
      }
    }

    let paintedColorClass: string | null = null;

    const clearColorClass = () => {
      if (paintedColorClass) root.classList.remove(paintedColorClass);

      paintedColorClass = null;
    };

    effect(() => {
      const next = rootColorClass();

      clearColorClass();

      if (next) root.classList.add(next);

      paintedColorClass = next;
    });

    const clearClasses = () => root.classList.remove(`${prefix}-scheme--light`, `${prefix}-scheme--dark`);

    const setMode = (next: ColorSchemeMode) => {
      clearClasses();

      if (next !== 'system') root.classList.add(`${prefix}-scheme--${next}`);

      mode.set(next);
    };

    inject(DestroyRef).onDestroy(() => {
      clearClasses();
      clearColorClass();
    });

    return { mode: mode.asReadonly(), type, rootSurface, setMode };
  },
  { name: 'Color Scheme' },
);

const provideColorSchemeState = /* @__PURE__ */ toProvideFn(COLOR_SCHEME_DEF);

/**
 * Inject the app's color scheme: `mode()` is what the app asked for, `type()` the surface type the
 * root paints, `rootSurface()` the default surface theme of that type, and `setMode()` switches it.
 * Needs `provideColorScheme()`.
 */
export const injectColorScheme = /* @__PURE__ */ toInjectFn(COLOR_SCHEME_DEF);

/**
 * Lets the app switch between its default light and dark surface with a class on `<html>`, instead of
 * only following `prefers-color-scheme`. It also paints the root surface's `colorThemeVariants` entry for the
 * default accent on `<html>`. Add it to the application config, next to
 * `provideSurfaceThemesWithTailwind4()`.
 */
export const provideColorScheme = (config?: ColorSchemeConfig): EnvironmentProviders =>
  makeEnvironmentProviders([
    provideColorSchemeState(),
    { provide: COLOR_SCHEME_TYPE, useFactory: () => injectColorScheme().type },
    provideEnvironmentInitializer(() => injectColorScheme().setMode(config?.mode ?? 'system')),
  ]);

/**
 * Inject a signal of the default surface theme the root paints where nothing scopes one. If the app
 * registers a default for both surface types, it follows `injectColorScheme()`, and is `null` without
 * `provideColorScheme()`.
 */
export const injectRootSurfaceTheme = (): Signal<SurfaceTheme | null> => {
  const defaults = injectSurfaceThemes({ optional: true })?.filter((theme) => theme.isDefault) ?? [];
  const colorSchemeType = inject(COLOR_SCHEME_TYPE, { optional: true });

  return computed(() => findRootSurfaceTheme(defaults, colorSchemeType?.()));
};
