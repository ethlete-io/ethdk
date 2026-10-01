import { isDevMode } from '@angular/core';
import {
  ColorTheme,
  createCssColorThemeName,
  ThemeSwatch,
  ɵProvideColorThemes,
  ɵProvideColorThemesPrefix,
} from './color-theme.util';

const SURFACE_TYPES = ['light', 'dark'] as const;
const INK_STATE_SUFFIXES = ['', '-hover', '-focus', '-active', '-disabled'] as const;

const createSurfaceInkVars = (name: string, swatch: ThemeSwatch) =>
  SURFACE_TYPES.map((type) => {
    const inkMap = swatch.inkColorBySurfaceType?.[type];

    if (!inkMap) return '';

    const hover = inkMap.hover || inkMap.default;

    return `
  --et-color-${name}-ink-${type}: ${inkMap.default};
  --et-color-${name}-ink-${type}-hover: ${hover};
  --et-color-${name}-ink-${type}-focus: ${inkMap.focus || hover};
  --et-color-${name}-ink-${type}-active: ${inkMap.active || inkMap.default};
  --et-color-${name}-ink-${type}-disabled: ${inkMap.disabled || inkMap.default};
  `;
  }).join('');

const createSurfaceInkCss = (themes: ColorTheme[]) => {
  if (!themes.some((theme) => theme.primary.inkColorBySurfaceType)) return '';

  const reset = SURFACE_TYPES.flatMap((type) =>
    INK_STATE_SUFFIXES.map((suffix) => `--et-color-primary-ink-${type}${suffix}: initial;`),
  ).join('\n');

  const resolve = INK_STATE_SUFFIXES.map((suffix) => {
    const plainInk = suffix
      ? `var(--et-color-primary-ink${suffix}, var(--et-color-primary-ink, var(--et-color-primary)))`
      : `var(--et-color-primary-ink, var(--et-color-primary))`;

    return `${SURFACE_TYPES.map(
      (type) =>
        `--_et-color-ink-${type}${suffix}: var(--et-surface-if-${type}) var(--et-color-primary-ink-${type}${suffix});`,
    ).join('\n')}
  --_et-color-ink${suffix}: var(--_et-color-ink-light${suffix}, var(--_et-color-ink-dark${suffix}, ${plainInk}));`;
  }).join('\n');

  return `
  :where([class*='et-color--']:not(.et-color--inherited)) {
    ${reset}
  }

  :root, :where([class*='et-color--']), :where([class*='et-surface--']) {
    ${resolve}
  }
  `;
};

/** Reads the nonce where Angular's default `CSP_NONCE` does, since these run outside any injector. */
const createNoncedStyle = () => {
  const style = document.createElement('style');
  const nonce = document.body?.querySelector('[ngCspNonce]')?.getAttribute('ngCspNonce');

  if (nonce) style.setAttribute('nonce', nonce);

  return style;
};

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export const createSwatchCss = (swatch: string, isAlt: boolean, data: ThemeSwatch) => {
  const varSuffix = isAlt ? 'alt-' + swatch : swatch;
  const varOnSuffix = isAlt ? 'alt-' : '';
  const inkDefault = data.inkColor?.default || data.color.default;
  const inkHover = data.inkColor?.hover || inkDefault;
  const inkFocus = data.inkColor?.focus || data.inkColor?.hover || inkDefault;
  const inkActive = data.inkColor?.active || inkDefault;
  const inkDisabled = data.inkColor?.disabled || inkDefault;

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

  --et-color-${varSuffix}-ink: ${inkDefault};
  --et-color-${varSuffix}-ink-hover: ${inkHover};
  --et-color-${varSuffix}-ink-focus: ${inkFocus};
  --et-color-${varSuffix}-ink-active: ${inkActive};
  --et-color-${varSuffix}-ink-disabled: ${inkDisabled};
  ${createSurfaceInkVars(varSuffix, data)}`;
};

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export const createRootThemeCss = (themes: ColorTheme[]) => {
  if (typeof document === 'undefined') return;

  const createVars = (name: string, swatch: ThemeSwatch) => {
    const inkDefault = swatch.inkColor?.default || swatch.color.default;
    const inkHover = swatch.inkColor?.hover || inkDefault;
    const inkFocus = swatch.inkColor?.focus || swatch.inkColor?.hover || inkDefault;
    const inkActive = swatch.inkColor?.active || inkDefault;
    const inkDisabled = swatch.inkColor?.disabled || inkDefault;

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

    --et-color-${name}-ink: ${inkDefault};
    --et-color-${name}-ink-hover: ${inkHover};
    --et-color-${name}-ink-focus: ${inkFocus};
    --et-color-${name}-ink-active: ${inkActive};
    --et-color-${name}-ink-disabled: ${inkDisabled};
    ${createSurfaceInkVars(name, swatch)}`;
  };

  const vars: string[] = [];

  for (const theme of themes) {
    const name = createCssColorThemeName(theme.name);

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
  ${createSurfaceInkCss(themes)}`;

  document.getElementById('et-root-themes')?.remove();
  const style = createNoncedStyle();
  style.id = `et-root-themes`;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
};

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export const createThemeStyle = (theme: ColorTheme, isAlt: boolean) => {
  if (typeof document === 'undefined') return;

  const cssThemeName = createCssColorThemeName(theme.name);
  const classPrefix = isAlt ? 'et-color-alt' : 'et-color';

  const selectors = [
    ...((theme.isDefault && !isAlt) || ((theme as ColorTheme & { isDefaultAlt?: boolean }).isDefaultAlt && isAlt)
      ? [':root', `.${classPrefix}--default`]
      : []),
    `.${classPrefix}--${cssThemeName}`,
  ];

  const css = `
  ${selectors.join(', ')} {
    ${createSwatchCss('primary', isAlt, theme.primary)}
    ${theme.secondary ? createSwatchCss('secondary', isAlt, theme.secondary) : ''}
    ${theme.tertiary ? createSwatchCss('tertiary', isAlt, theme.tertiary) : ''}
  }
  `;

  document.getElementById(`${classPrefix}--${cssThemeName}`)?.remove();
  const style = createNoncedStyle();
  style.id = `${classPrefix}--${cssThemeName}`;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
};

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export const createTailwindCssVar = (name: string | undefined) => (name ? `rgb(var(--${name}) / <alpha-value>)` : null);

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export function createTailwindRgbVar(val: string): string;
export function createTailwindRgbVar(val: string | undefined): string | null;
export function createTailwindRgbVar(val: string | undefined) {
  return val ? `rgb(${val} / <alpha-value>)` : null;
}

/**
 * @deprecated Migrate to Tailwind v4. Intent to remove in v6.
 */
export const createTailwindColorThemes = (themes: ColorTheme[], prefix = 'et') => {
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
      DEFAULT: createTailwindRgbVar(theme.primary.color.default),
      hover: createTailwindRgbVar(theme.primary.color.hover),
      focus: createTailwindRgbVar(theme.primary.color.focus) || createTailwindRgbVar(theme.primary.color.hover),
      active: createTailwindRgbVar(theme.primary.color.active),
      disabled: createTailwindRgbVar(theme.primary.color.disabled),
    };

    const keyOn = `${prefix}-on-${theme.name}`;

    twThemes[keyOn] = {
      DEFAULT: createTailwindRgbVar(theme.primary.onColor.default),
      hover: createTailwindRgbVar(theme.primary.onColor.hover) || createTailwindRgbVar(theme.primary.onColor.default),
      focus:
        createTailwindRgbVar(theme.primary.onColor.focus) ||
        createTailwindRgbVar(theme.primary.onColor.hover) ||
        createTailwindRgbVar(theme.primary.onColor.default),
      active: createTailwindRgbVar(theme.primary.onColor.active) || createTailwindRgbVar(theme.primary.onColor.default),
      disabled:
        createTailwindRgbVar(theme.primary.onColor.disabled) || createTailwindRgbVar(theme.primary.onColor.default),
    };

    for (const type of SURFACE_TYPES) {
      const inkMap = theme.primary.inkColorBySurfaceType?.[type];

      if (!inkMap) continue;

      twThemes[`${prefix}-${theme.name}-ink-${type}`] = {
        DEFAULT: createTailwindRgbVar(inkMap.default),
        hover: createTailwindRgbVar(inkMap.hover || inkMap.default),
        focus: createTailwindRgbVar(inkMap.focus || inkMap.hover || inkMap.default),
        active: createTailwindRgbVar(inkMap.active || inkMap.default),
        disabled: createTailwindRgbVar(inkMap.disabled || inkMap.default),
      };
    }

    const keyInk = `${prefix}-${theme.name}-ink`;

    twThemes[keyInk] = {
      DEFAULT:
        createTailwindRgbVar(theme.primary.inkColor?.default) || createTailwindRgbVar(theme.primary.color.default),
      hover:
        createTailwindRgbVar(theme.primary.inkColor?.hover) ||
        createTailwindRgbVar(theme.primary.inkColor?.default) ||
        createTailwindRgbVar(theme.primary.color.default),
      focus:
        createTailwindRgbVar(theme.primary.inkColor?.focus) ||
        createTailwindRgbVar(theme.primary.inkColor?.hover) ||
        createTailwindRgbVar(theme.primary.inkColor?.default) ||
        createTailwindRgbVar(theme.primary.color.default),
      active:
        createTailwindRgbVar(theme.primary.inkColor?.active) ||
        createTailwindRgbVar(theme.primary.inkColor?.default) ||
        createTailwindRgbVar(theme.primary.color.default),
      disabled:
        createTailwindRgbVar(theme.primary.inkColor?.disabled) ||
        createTailwindRgbVar(theme.primary.inkColor?.default) ||
        createTailwindRgbVar(theme.primary.color.default),
    };
  }

  return twThemes;
};

/**
 * @deprecated Use provideColorThemesWithTailwind4 instead after migrating to Tailwind CSS v4. Intent to remove in v6.
 */
export const provideColorThemes = (themes: ColorTheme[]) => {
  if (isDevMode()) {
    const defaultCount = themes.filter((theme) => theme.isDefault).length;
    const defaultAltCount = themes.filter(
      (theme) => (theme as ColorTheme & { isDefaultAlt?: boolean }).isDefaultAlt,
    ).length;

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

  return [ɵProvideColorThemes(themes), ɵProvideColorThemesPrefix('et')];
};
