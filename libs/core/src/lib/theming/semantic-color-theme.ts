import { computed, inject, isDevMode, Signal } from '@angular/core';
import { injectRootSurfaceTheme } from './color-scheme';
import { resolveColorThemeVariant } from './color-theme-variant';
import { ColorTheme, ColorThemeType, injectColorThemes } from './color-theme.util';
import { SURFACE_PROVIDER } from './provide-surface.directive';

const findColorThemeByType = (themes: ColorTheme[] | null, type: ColorThemeType, caller: string) => {
  if (!themes) {
    throw new Error(`[${caller}] No color themes provided. Call provideColorThemesWithTailwind4() in your app config.`);
  }

  const theme = themes.find((t) => t.type === type);

  if (!theme) {
    throw new Error(
      `[${caller}] No color theme with type "${type}" found. Add a theme with type: "${type}" to provideColorThemesWithTailwind4().`,
    );
  }

  if (isDevMode()) {
    const duplicates = themes.filter((t) => t.type === type);

    if (duplicates.length > 1) {
      console.error(
        `[${caller}] Multiple themes with type "${type}" found: ${duplicates.map((t) => t.name).join(', ')}. Only the first one will be used.`,
      );
    }
  }

  return theme;
};

const injectColorThemeByType = (type: ColorThemeType) =>
  findColorThemeByType(injectColorThemes({ optional: true }), type, 'injectColorThemeByType');

/**
 * A signal of the color theme for `type` on the surface this element renders on: the first registered theme
 * of that `type`, swapped for the nearest surface's `colorThemeVariants` entry. Reading it throws when the app
 * registered no theme of that `type`, so read it only for a state that renders.
 *
 * @example
 * protected successTheme = injectSemanticColorTheme('success');
 * // <span [etProvideColor]="successTheme()">+12%</span>
 */
export const injectSemanticColorTheme = (type: ColorThemeType): Signal<ColorTheme> => {
  const themes = injectColorThemes({ optional: true });
  const surfaceProvider = inject(SURFACE_PROVIDER, { optional: true });
  const rootSurface = injectRootSurfaceTheme();

  return computed(() => {
    const chosen = findColorThemeByType(themes, type, 'injectSemanticColorTheme');
    const surface = surfaceProvider?.activeTheme() ?? rootSurface();
    const variantName = resolveColorThemeVariant(surface, chosen.name, themes);

    if (variantName === chosen.name) return chosen;

    const variant = themes?.find((t) => t.name === variantName);

    if (variant) return variant;

    if (isDevMode()) {
      console.error(
        `[injectSemanticColorTheme] Surface theme "${surface?.name}" maps "${type}" to the color theme "${variantName}", which is not registered. Add it to provideColorThemesWithTailwind4().`,
      );
    }

    return chosen;
  });
};

/** @deprecated Use `injectSemanticColorTheme('error')`, which follows the surface the element renders on. */
export const injectErrorTheme = () => injectColorThemeByType('error');
/** @deprecated Use `injectSemanticColorTheme('warning')`, which follows the surface the element renders on. */
export const injectWarningTheme = () => injectColorThemeByType('warning');
/** @deprecated Use `injectSemanticColorTheme('success')`, which follows the surface the element renders on. */
export const injectSuccessTheme = () => injectColorThemeByType('success');
