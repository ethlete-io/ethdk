import { isDevMode } from '@angular/core';
import { defineStaticProvider, toInjectFn, toProvideFn } from '../utils';

export type ThemeRGBColor = `${number} ${number} ${number}`;
export type ThemeHSLColor = `${number} ${number}% ${number}%`;

export type ThemeColor = ThemeRGBColor | ThemeHSLColor;

export type ThemeColorMap = {
  default: ThemeColor;
  hover: ThemeColor;
  focus?: ThemeColor;
  active: ThemeColor;
  disabled: ThemeColor;
};

export type OnThemeColorMap = {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
};

export type ThemeInkColorMap = {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
};

export type ThemeSwatch = {
  color: ThemeColorMap;
  onColor: OnThemeColorMap;
  inkColor?: ThemeInkColorMap;
};

export type ColorThemeType = 'success' | 'warning' | 'error';

export type ColorTheme = {
  name: string;
  type?: ColorThemeType;
  isDefault?: boolean;
  primary: ThemeSwatch;
  secondary?: ThemeSwatch;
  tertiary?: ThemeSwatch;
};

/**
 * Augmentable registry for the literal set of color theme names an app defines. Left
 * empty by default, which keeps theme-name-accepting APIs (like `etProvideColor`) typed
 * as plain `string`.
 *
 * Apps that want those APIs checked and autocompleted against their own theme names
 * should augment this interface once, near where their themes are defined:
 *
 * ```ts
 * declare module '@ethlete/core' {
 *   interface EthleteColorThemeNameRegistry {
 *     name: 'pitch-green' | 'red' | 'light-grey';
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface EthleteColorThemeNameRegistry {
  // Intentionally empty - see doc comment above.
}

export type RegisteredColorThemeName = EthleteColorThemeNameRegistry extends { name: infer N extends string }
  ? N
  : string;

export const createCssColorThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0]!.toLowerCase()}`);

const COLOR_THEMES_DEF = /* @__PURE__ */ defineStaticProvider<ColorTheme[]>(undefined, {
  name: 'Color Themes',
});

export const ɵProvideColorThemes = /* @__PURE__ */ toProvideFn(COLOR_THEMES_DEF);
export const injectColorThemes = /* @__PURE__ */ toInjectFn(COLOR_THEMES_DEF);
const COLOR_THEMES_PREFIX_DEF = /* @__PURE__ */ defineStaticProvider('et', {
  name: 'Themes Prefix',
});

export const ɵProvideColorThemesPrefix = /* @__PURE__ */ toProvideFn(COLOR_THEMES_PREFIX_DEF);
export const injectColorThemesPrefix = /* @__PURE__ */ toInjectFn(COLOR_THEMES_PREFIX_DEF);

export const provideColorThemesWithTailwind4 = (themes: ColorTheme[], prefix = 'et') => [
  ɵProvideColorThemes(themes),
  ɵProvideColorThemesPrefix(prefix),
];

const injectColorThemeByType = (type: ColorThemeType) => {
  const themes = injectColorThemes();

  if (!themes) {
    throw new Error(
      `[injectColorThemeByType] No color themes provided. Call provideColorThemesWithTailwind4() in your app config.`,
    );
  }

  const theme = themes.find((t) => t.type === type);

  if (!theme) {
    throw new Error(
      `[injectColorThemeByType] No color theme with type "${type}" found. Add a theme with type: "${type}" to provideColorThemesWithTailwind4().`,
    );
  }

  if (isDevMode()) {
    const duplicates = themes.filter((t) => t.type === type);

    if (duplicates.length > 1) {
      console.error(
        `[injectColorThemeByType] Multiple themes with type "${type}" found: ${duplicates.map((t) => t.name).join(', ')}. Only the first one will be used.`,
      );
    }
  }

  return theme;
};

export const injectErrorTheme = () => injectColorThemeByType('error');
export const injectWarningTheme = () => injectColorThemeByType('warning');
export const injectSuccessTheme = () => injectColorThemeByType('success');
