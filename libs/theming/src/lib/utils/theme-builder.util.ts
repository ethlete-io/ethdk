import { Theme } from '../types';

export const buildTheme = (theme: Theme) => {
  return `et-themeable et-theme-${theme}`;
};
