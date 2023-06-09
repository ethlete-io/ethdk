import { Provider, isDevMode } from '@angular/core';
import { THEMES_TOKEN } from '../constants';
import { Theme } from '../types';

export const createCssThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);

export const createThemeStyle = (theme: Theme) => {
  const cssThemeName = createCssThemeName(theme.name);

  const selectors = [...(theme.isDefault ? [':root', `.et-theme--default`] : []), `.et-theme--${cssThemeName}`];

  const css = `
  ${selectors.join(', ')} {
    --et-theme: ${theme.color.default};
    --et-theme-hover: ${theme.color.hover};
    --et-theme-focus: ${theme.color.focus || theme.color.hover};
    --et-theme-active: ${theme.color.active};
    --et-theme-disabled: ${theme.color.disabled};

    --et-theme-on: ${theme.onColor.default};
    --et-theme-on-hover: ${theme.onColor.hover};
    --et-theme-on-focus: ${theme.onColor.focus || theme.onColor.hover};
    --et-theme-on-active: ${theme.onColor.active};
    --et-theme-on-disabled: ${theme.onColor.disabled};
  }
  `;

  const cssString = isDevMode() ? css : css.replace(/\s/g, '');

  const style = document.createElement('style');
  style.id = `et-theme--${cssThemeName}`;
  style.appendChild(document.createTextNode(cssString));
  document.head.appendChild(style);

  console.log(cssString);
};

export const provideThemes = (themes: Theme[]) => {
  for (const theme of themes) {
    createThemeStyle(theme);
  }

  return { provide: THEMES_TOKEN, useValue: themes.map((theme) => theme.name) } satisfies Provider;
};
