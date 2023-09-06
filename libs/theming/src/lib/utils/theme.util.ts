import { Provider, isDevMode } from '@angular/core';
import { THEMES_TOKEN } from '../constants';
import { Theme, ThemeSwatch } from '../types';

export const createCssThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);

export const createSwatchCss = (swatch: string, isAlt: boolean, data: ThemeSwatch) => {
  const varSuffix = isAlt ? 'alt-' + swatch : swatch;
  const varOnSuffix = isAlt ? 'alt-' : '';

  return `
  --et-color-${varSuffix}: ${data.color.default};
  --et-color-${varSuffix}-hover: ${data.color.hover};
  --et-color-${varSuffix}-focus: ${data.color.focus || data.color.hover};
  --et-color-${varSuffix}-active: ${data.color.active};
  --et-color-${varSuffix}-disabled: ${data.color.disabled};
  
  --et-color-${varOnSuffix}on-${swatch}: ${data.onColor.default};
  --et-color-${varOnSuffix}on-${swatch}-hover: ${data.onColor.hover || data.onColor.default};
  --et-color-${varOnSuffix}on-${swatch}-focus: ${data.onColor.focus || data.onColor.hover || data.onColor.default};
  --et-color-${varOnSuffix}on-${swatch}-active: ${data.onColor.active || data.onColor.default};
  --et-color-${varOnSuffix}on-${swatch}-disabled: ${data.onColor.disabled || data.onColor.default};
  `;
};

export const createThemeStyle = (theme: Theme, isAlt: boolean) => {
  const cssThemeName = createCssThemeName(theme.name);
  const stringSuffix = isAlt ? '-alt' : '';

  const selectors = [
    ...((theme.isDefault && !isAlt) || (theme.isDefaultAlt && isAlt)
      ? [':root', `.et-theme${stringSuffix}--default`]
      : []),
    `.et-theme${stringSuffix}--${cssThemeName}`,
  ];

  const css = `
  ${selectors.join(', ')} {
    ${createSwatchCss('primary', isAlt, theme.primary)}
    ${theme.secondary ? createSwatchCss('secondary', isAlt, theme.secondary) : ''}
    ${theme.tertiary ? createSwatchCss('tertiary', isAlt, theme.tertiary) : ''}
  }
  `;

  const style = document.createElement('style');
  style.id = `et-theme${stringSuffix}--${cssThemeName}`;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
};

export const provideThemes = (themes: Theme[]) => {
  if (isDevMode()) {
    const defaultCount = themes.filter((theme) => theme.isDefault).length;
    const defaultAltCount = themes.filter((theme) => theme.isDefaultAlt).length;

    if (defaultCount === 0) {
      console.warn(
        'No default theme provided. Please provide a default theme by setting the isDefault property to true on a theme.',
      );
    } else if (defaultCount > 1) {
      console.warn(
        'More than one default theme provided. Please provide only one default theme by setting the isDefault property to true on a theme.',
      );
    }

    if (defaultAltCount > 1) {
      console.warn(
        'More than one default alt theme provided. Please provide only one default alt theme by setting the isDefaultAlt property to true on a theme.',
      );
    }
  }

  for (const theme of themes) {
    createThemeStyle(theme, false);
    createThemeStyle(theme, true);
  }

  return { provide: THEMES_TOKEN, useValue: themes.map((theme) => theme.name) } satisfies Provider;
};
