import { createStaticProvider } from '../utils';

export type ThemeRGBColor = `${number} ${number} ${number}`;
export type ThemeHSLColor = `${number} ${number}% ${number}%`;

export type ThemeColor = ThemeRGBColor | ThemeHSLColor;

export interface ThemeColorMap {
  default: ThemeColor;
  hover: ThemeColor;
  focus?: ThemeColor;
  active: ThemeColor;
  disabled: ThemeColor;
}

export interface OnThemeColorMap {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
}

export interface ThemeSwatch {
  color: ThemeColorMap;
  onColor: OnThemeColorMap;
}

export interface Theme {
  name: string;
  isDefault?: boolean;
  isDefaultAlt?: boolean;
  primary: ThemeSwatch;
  secondary?: ThemeSwatch;
  tertiary?: ThemeSwatch;
}

export const createCssThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0]!.toLowerCase()}`);

export const [internalProvideColorThemes, injectColorThemes] = createStaticProvider<string[]>();
export const [internalProvideThemesPrefix, injectThemesPrefix] = createStaticProvider('et');

export const provideColorThemesWithTailwind4 = (themes: Theme[], prefix = 'et') => [
  internalProvideColorThemes(themes.map((theme) => theme.name)),
  internalProvideThemesPrefix(prefix),
];
