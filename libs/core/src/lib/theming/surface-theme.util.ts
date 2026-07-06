import { createStaticProvider } from '../utils';

export const SURFACE_TYPE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type SurfaceType = (typeof SURFACE_TYPE)[keyof typeof SURFACE_TYPE];

export type SurfaceThemeColor = `${number} ${number} ${number}`;

export type SurfaceInteractionColor = {
  default: SurfaceThemeColor;
  hover: SurfaceThemeColor;
  focus: SurfaceThemeColor;
  active: SurfaceThemeColor;
  disabled: SurfaceThemeColor;
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface EthleteSurfaceThemeNameRegistry {
  // Intentionally empty - see doc comment above.
}

export type RegisteredSurfaceThemeName = EthleteSurfaceThemeNameRegistry extends { name: infer N extends string }
  ? N
  : string;

export const createCssSurfaceName = (name: string) => name.replace(/([A-Z])/g, (g) => `-${g[0]!.toLowerCase()}`);

export const resolveSurfaceByElevation = (themes: SurfaceTheme[], type: SurfaceType, elevation: number) =>
  themes.find((t) => t.type === type && t.elevation === elevation) ?? null;

export const [ɵProvideSurfaceThemes, injectSurfaceThemes] = createStaticProvider<SurfaceTheme[]>(undefined, {
  name: 'Surface Themes',
});

export const [ɵProvideSurfaceThemesPrefix, injectSurfaceThemesPrefix] = createStaticProvider('et', {
  name: 'Surface Themes Prefix',
});

export const provideSurfaceThemesWithTailwind4 = (themes: SurfaceTheme[], prefix = 'et') => [
  ɵProvideSurfaceThemes(themes),
  ɵProvideSurfaceThemesPrefix(prefix),
];
