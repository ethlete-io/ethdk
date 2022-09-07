import { THEME_CONFIG } from '../constants';
import { Themeable, ThemeConfig } from '../types';

export const buildTheme = (theme: string) => {
  return `et-themeable et-theme--${theme}`;
};

export const applyTheme = (themeable: Themeable) => {
  const { _theme, _elementRef, _themeConfig } = themeable;
  const { defaultTheme } = _themeConfig;

  if (!_themeConfig.themes.includes(_theme)) {
    console.warn(
      `Theme "${_theme}" is not defined in the theme config. Using default theme "${defaultTheme}" instead.`,
      themeable._elementRef.nativeElement,
    );
    themeable._theme = defaultTheme;
  }

  const themeClass = buildTheme(_theme || defaultTheme);
  _elementRef.nativeElement.className = themeClass;
};

export const provideThemeConfig = (themeConfig: ThemeConfig) => {
  return { provide: THEME_CONFIG, useValue: themeConfig };
};
