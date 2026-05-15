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
