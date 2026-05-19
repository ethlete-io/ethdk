import { isDevMode } from '@angular/core';
import { createStaticProvider } from '../utils';

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

export const createCssColorThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0]!.toLowerCase()}`);

export const [ɵProvideColorThemes, injectColorThemes] = createStaticProvider<ColorTheme[]>(undefined, {
  name: 'Color Themes',
});
export const [ɵProvideColorThemesPrefix, injectColorThemesPrefix] = createStaticProvider('et', {
  name: 'Themes Prefix',
});

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
