import { Provider, isDevMode } from '@angular/core';
import { THEMES_TOKEN } from '../constants';
import { Theme, ThemeSwatch } from '../types';

export const createCssThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);

export const createSwatchCss = (swatch: string, data: ThemeSwatch) => `
--et-color-${swatch}: ${data.color.default};
--et-color-${swatch}-hover: ${data.color.hover};
--et-color-${swatch}-focus: ${data.color.focus || data.color.hover};
--et-color-${swatch}-active: ${data.color.active};
--et-color-${swatch}-disabled: ${data.color.disabled};

--et-color-on-${swatch}: ${data.onColor.default};
--et-color-on-${swatch}-hover: ${data.onColor.hover || data.onColor.default};
--et-color-on-${swatch}-focus: ${data.onColor.focus || data.onColor.hover || data.onColor.default};
--et-color-on-${swatch}-active: ${data.onColor.active || data.onColor.default};
--et-color-on-${swatch}-disabled: ${data.onColor.disabled || data.onColor.default};
`;

export const createThemeStyle = (theme: Theme) => {
  const cssThemeName = createCssThemeName(theme.name);

  const selectors = [...(theme.isDefault ? [':root', `.et-theme--default`] : []), `.et-theme--${cssThemeName}`];

  const css = `
  ${selectors.join(', ')} {
    ${createSwatchCss('primary', theme.primary)}
    ${theme.secondary ? createSwatchCss('secondary', theme.secondary) : ''}
    ${theme.tertiary ? createSwatchCss('tertiary', theme.tertiary) : ''}
  }
  `;

  const cssString = isDevMode() ? css : css.replace(/\s/g, '');

  const style = document.createElement('style');
  style.id = `et-theme--${cssThemeName}`;
  style.appendChild(document.createTextNode(cssString));
  document.head.appendChild(style);
};

export const provideThemes = (themes: Theme[]) => {
  if (isDevMode()) {
    const defaultCount = themes.filter((theme) => theme.isDefault).length;

    if (defaultCount === 0) {
      console.warn(
        'No default theme provided. Please provide a default theme by setting the isDefault property to true on a theme.',
      );
    } else if (defaultCount > 1) {
      console.warn(
        'More than one default theme provided. Please provide only one default theme by setting the isDefault property to true on a theme.',
      );
    }
  }

  for (const theme of themes) {
    createThemeStyle(theme);
  }

  return { provide: THEMES_TOKEN, useValue: themes.map((theme) => theme.name) } satisfies Provider;
};
