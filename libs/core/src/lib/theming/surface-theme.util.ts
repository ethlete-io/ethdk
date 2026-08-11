import { defineStaticProvider, toInjectFn, toProvideFn } from '../utils';

export const SURFACE_TYPE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type SurfaceType = (typeof SURFACE_TYPE)[keyof typeof SURFACE_TYPE];

export type SurfaceThemeColor = `${number} ${number} ${number}`;

export type SurfaceInteractionColorMap = {
  default: SurfaceThemeColor;
  hover: SurfaceThemeColor;
  focus: SurfaceThemeColor;
  active: SurfaceThemeColor;
  disabled: SurfaceThemeColor;
};

export type SurfaceOnInteractionColorMap = {
  default: SurfaceThemeColor;
  hover?: SurfaceThemeColor;
  focus?: SurfaceThemeColor;
  active?: SurfaceThemeColor;
  disabled?: SurfaceThemeColor;
};

/**
 * The surface's neutral color, shaped like a color theme's swatch. It serves both roles: `color`
 * is the tint source `[etSurfaceInteractive]` mixes for hover/active feedback, and the whole
 * swatch is the palette a component picks up from `[etProvideColor]="'surface'"`.
 *
 * `onColor` (text on a filled neutral) defaults to the surface background, `inkColor` (text and
 * borders on a tinted or transparent neutral) to the surface color.
 */
export type SurfaceInteractionColor = {
  color: SurfaceInteractionColorMap;
  onColor?: SurfaceOnInteractionColorMap;
  inkColor?: SurfaceOnInteractionColorMap;
};

export type SurfaceTheme = {
  name: string;
  type: SurfaceType;
  elevation: number;
  isDefault?: boolean;
  interactionColor?: SurfaceInteractionColor;
  background: SurfaceThemeColor;
  color: SurfaceThemeColor;
  colorMuted: SurfaceThemeColor;
  colorSubtle: SurfaceThemeColor;
  border: SurfaceThemeColor;
};

/**
 * Augmentable registry for the literal set of surface theme names an app defines. Left
 * empty by default, which keeps surface-theme-name-accepting APIs (like `etProvideSurface`)
 * typed as plain `string`.
 *
 * Apps that want those APIs checked and autocompleted against their own surface theme
 * names should augment this interface once, near where their surface themes are defined:
 *
 * ```ts
 * declare module '@ethlete/core' {
 *   interface EthleteSurfaceThemeNameRegistry {
 *     name: 'card' | 'sheet' | 'popover';
 *   }
 * }
 * ```
 */
// This must stay an `interface`: consumers register their theme names by augmenting it from a
// `declare module` block, which only works for interfaces.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/consistent-type-definitions
export interface EthleteSurfaceThemeNameRegistry {
  // Intentionally empty - see doc comment above.
}

export type RegisteredSurfaceThemeName = EthleteSurfaceThemeNameRegistry extends { name: infer N extends string }
  ? N
  : string;

export const createCssSurfaceName = (name: string) => name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export const resolveSurfaceByElevation = (themes: SurfaceTheme[], type: SurfaceType, elevation: number) =>
  themes.find((t) => t.type === type && t.elevation === elevation) ?? null;

const SURFACE_THEMES_DEF = /* @__PURE__ */ defineStaticProvider<SurfaceTheme[]>(undefined, {
  name: 'Surface Themes',
});

export const ɵProvideSurfaceThemes = /* @__PURE__ */ toProvideFn(SURFACE_THEMES_DEF);
export const injectSurfaceThemes = /* @__PURE__ */ toInjectFn(SURFACE_THEMES_DEF);

const SURFACE_THEMES_PREFIX_DEF = /* @__PURE__ */ defineStaticProvider('et', {
  name: 'Surface Themes Prefix',
});

export const ɵProvideSurfaceThemesPrefix = /* @__PURE__ */ toProvideFn(SURFACE_THEMES_PREFIX_DEF);
export const injectSurfaceThemesPrefix = /* @__PURE__ */ toInjectFn(SURFACE_THEMES_PREFIX_DEF);

export const provideSurfaceThemesWithTailwind4 = (themes: SurfaceTheme[], prefix = 'et') => [
  ɵProvideSurfaceThemes(themes),
  ɵProvideSurfaceThemesPrefix(prefix),
];
