import { isDevMode } from '@angular/core';
import { defineStaticProvider, toInjectFn, toProvideFn } from '../utils';
import { RuntimeError } from '../utils/runtime-error';
import { RegisteredColorThemeName } from './color-theme.util';
import { provideRootFontSizeCheck } from './root-font-size-check';
import { THEMING_ERROR_CODES } from './theming-errors';

export const SURFACE_TYPE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type SurfaceType = (typeof SURFACE_TYPE)[keyof typeof SURFACE_TYPE];

export type SurfaceThemeColor = `${number} ${number} ${number}`;

export type SurfaceControlTextMap = {
  default: SurfaceThemeColor;
  hover?: SurfaceThemeColor;
  focus?: SurfaceThemeColor;
  active?: SurfaceThemeColor;
  disabled?: SurfaceThemeColor;
};

export type SurfaceTheme = {
  name: RegisteredSurfaceThemeName;
  type: SurfaceType;
  elevation: number;
  isDefault?: boolean;
  /** The source hover and pressed feedback mixes into a neutral control on this surface. */
  tint?: SurfaceThemeColor;
  /**
   * The text color of a neutral control on this surface, per state. A missing state falls back to
   * `hover` for focus and to `default` otherwise. Also the fill of `[etProvideColor]="'surface'"`.
   */
  controlText?: SurfaceControlTextMap;
  /**
   * Swaps a chosen color theme for a version that reads well on this surface, e.g.
   * `{ brand: 'brand-on-light', grey: 'grey-light' }`. The chosen theme is the nearest `[etProvideColor]`, the
   * `isDefault` theme where there is none, or the theme of a `type` for `injectSemanticColorTheme()`. An
   * accent without an entry stays the same on this surface.
   */
  colorThemeVariants?: Partial<Record<RegisteredColorThemeName, RegisteredColorThemeName>>;
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, ethlete/consistent-type-definitions
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

/**
 * Registers the app's surface themes. In dev mode it also warns once the page has loaded if the root
 * font size is still the browser default, i.e. the app is missing `html { font-size: 62.5%; }`.
 */
export const provideSurfaceThemesWithTailwind4 = (themes: SurfaceTheme[], prefix = 'et') => {
  if (isDevMode()) {
    for (const type of ['light', 'dark'] as const) {
      const defaults = themes.filter((theme) => theme.isDefault && theme.type === type);

      if (defaults.length > 1) {
        throw new RuntimeError(
          THEMING_ERROR_CODES.DUPLICATE_DEFAULT_SURFACE_THEME,
          `[provideSurfaceThemesWithTailwind4] Surface themes ${defaults.map((t) => `"${t.name}"`).join(' and ')} are both the isDefault ${type} surface. Keep isDefault on one per type.`,
        );
      }
    }
  }

  return [
    ɵProvideSurfaceThemes(themes),
    ɵProvideSurfaceThemesPrefix(prefix),
    ngDevMode ? provideRootFontSizeCheck() : [],
  ];
};

/**
 * Inject the registered `isDefault` surface theme of a `type` - the surface an app renders on
 * where nothing scopes one. Without a `type`, resolves the default of the only surface type the
 * app registers; an app registering both must name the one it means. `null` when neither applies.
 * For the theme the root paints right now, use `injectRootSurfaceTheme()`.
 */
export const injectDefaultSurfaceTheme = (type?: SurfaceType) => {
  const defaults = injectSurfaceThemes({ optional: true })?.filter((theme) => theme.isDefault) ?? [];

  if (type) return defaults.find((theme) => theme.type === type) ?? null;

  return defaults.length === 1 ? (defaults[0] ?? null) : null;
};
