import { Provider, isDevMode } from '@angular/core';
import { THEMES_TOKEN } from '../constants';
import { Theme, ThemeSwatch } from '../types';

export const createCssThemeName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0]!.toLowerCase()}`);

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

export const createRootThemeCss = (themes: Theme[]) => {
  const createVars = (name: string, swatch: ThemeSwatch) => {
    return `
    --et-color-${name}: ${swatch.color.default};
    --et-color-${name}-hover: ${swatch.color.hover};
    --et-color-${name}-focus: ${swatch.color.focus || swatch.color.hover};
    --et-color-${name}-active: ${swatch.color.active};
    --et-color-${name}-disabled: ${swatch.color.disabled};
    
    --et-color-on-${name}: ${swatch.onColor.default};
    --et-color-on-${name}-hover: ${swatch.onColor.hover || swatch.onColor.default};
    --et-color-on-${name}-focus: ${swatch.onColor.focus || swatch.onColor.hover || swatch.onColor.default};
    --et-color-on-${name}-active: ${swatch.onColor.active || swatch.onColor.default};
    --et-color-on-${name}-disabled: ${swatch.onColor.disabled || swatch.onColor.default};
    `;
  };

  const vars: string[] = [];

  for (const theme of themes) {
    const name = createCssThemeName(theme.name);

    if (theme.secondary || theme.tertiary) {
      vars.push(createVars(`${name}-primary`, theme.primary));

      if (theme.secondary) {
        vars.push(createVars(`${name}-secondary`, theme.secondary));
      }

      if (theme.tertiary) {
        vars.push(createVars(`${name}-tertiary`, theme.tertiary));
      }
    } else {
      vars.push(createVars(name, theme.primary));
    }
  }

  const css = `
  :root {
    ${vars.join('\n')}
  }
  `;

  const style = document.createElement('style');
  style.id = `et-root-themes`;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
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

export const createTailwindCssVar = (name: string | undefined) => (name ? `rgb(var(--${name}) / <alpha-value>)` : null);
export const createTailwindRgbVar = (val: string | undefined) => (val ? `rgb(${val} / <alpha-value>)` : null);

export const createTailwindColorThemes = (themes: Theme[], prefix = 'et') => {
  const twThemes: Record<
    string,
    {
      DEFAULT: string;
      hover: string;
      focus: string;
      active: string;
      disabled: string;
    }
  > = {};

  for (const theme of themes) {
    const key = `${prefix}-${theme.name}`;

    twThemes[key] = {
      DEFAULT: createTailwindRgbVar(theme.primary.color.default)!,
      hover: createTailwindRgbVar(theme.primary.color.hover)!,
      focus: createTailwindRgbVar(theme.primary.color.focus) || createTailwindRgbVar(theme.primary.color.hover)!,
      active: createTailwindRgbVar(theme.primary.color.active)!,
      disabled: createTailwindRgbVar(theme.primary.color.disabled)!,
    };

    const keyOn = `${prefix}-on-${theme.name}`;

    twThemes[keyOn] = {
      DEFAULT: createTailwindRgbVar(theme.primary.onColor.default)!,
      hover: createTailwindRgbVar(theme.primary.onColor.hover) || createTailwindRgbVar(theme.primary.onColor.default)!,
      focus:
        createTailwindRgbVar(theme.primary.onColor.focus) ||
        createTailwindRgbVar(theme.primary.onColor.hover) ||
        createTailwindRgbVar(theme.primary.onColor.default)!,
      active:
        createTailwindRgbVar(theme.primary.onColor.active) || createTailwindRgbVar(theme.primary.onColor.default)!,
      disabled:
        createTailwindRgbVar(theme.primary.onColor.disabled) || createTailwindRgbVar(theme.primary.onColor.default)!,
    };
  }

  return twThemes;
};

export const provideColorThemes = (themes: Theme[]) => {
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

  createRootThemeCss(themes);

  return { provide: THEMES_TOKEN, useValue: themes.map((theme) => theme.name) } satisfies Provider;
};

export const provideColorThemesWithTailwind4 = (themes: Theme[]) => {
  return { provide: THEMES_TOKEN, useValue: themes.map((theme) => theme.name) } satisfies Provider;
};

export const provideSurfaceThemes = (themes: Theme[]) => {
  //TODO: implement
};
