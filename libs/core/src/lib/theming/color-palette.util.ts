import { computed, InjectOptions, Signal } from '@angular/core';
import { defineStaticProvider, toInjectFn, toToken } from '../utils';
import { RegisteredColorThemeName } from './color-theme.util';
import { injectParentSurface } from './provide-surface.directive';
import { RegisteredSurfaceThemeName } from './surface-theme.util';

/** One choice in a {@link provideColorPalette} palette. */
export type ColorPaletteEntry = {
  /** The color theme this choice selects - a name the app registered with `provideColorThemesWithTailwind4`. */
  token: RegisteredColorThemeName;
  /** What a user reads next to the swatch. Provide it already translated. */
  label: string;
};

/**
 * One palette per surface theme the app registered, keyed by the surface theme name. `default` is
 * used on every surface without its own list. Every list must keep the same order.
 */
export type ColorPaletteBySurface = { default: ColorPaletteEntry[] } & Partial<
  Record<RegisteredSurfaceThemeName, ColorPaletteEntry[]>
>;

export type ColorPaletteConfig = ColorPaletteEntry[] | ColorPaletteBySurface;

const COLOR_PALETTE_DEF = /* @__PURE__ */ defineStaticProvider<ColorPaletteConfig>(undefined, {
  name: 'Color Palette',
});

const injectColorPaletteConfig = /* @__PURE__ */ toInjectFn(COLOR_PALETTE_DEF);

const selectPalette = (config: ColorPaletteConfig, surface: RegisteredSurfaceThemeName | null) => {
  if (Array.isArray(config)) return config;

  return (surface === null ? undefined : config[surface]) ?? config.default;
};

/**
 * The color themes a subtree may offer a user as pickable choices, in the order they should appear.
 * A curated slice of what `provideColorThemesWithTailwind4` registered: an app registers every theme
 * it renders with, including ones nobody should pick by hand (`error`, `warning`), and adds the
 * user-facing label a swatch needs.
 *
 * Pass one list, or one list per registered surface theme name plus a `default`. The charts draw with
 * the list of the surface they sit on; a color picker always offers the `default` list.
 *
 * @example
 * provideColorPalette([
 *   { token: 'brand', label: 'Team green' },
 *   { token: 'ocean', label: 'Training blue' },
 * ]);
 *
 * @example
 * provideColorPalette({
 *   default: [{ token: 'ocean', label: 'Training' }],
 *   'dark-card': [{ token: 'ocean-bright', label: 'Training' }],
 * });
 */
export const provideColorPalette = (palette: ColorPaletteConfig) => COLOR_PALETTE_DEF.provide(palette);

/**
 * The palette from {@link provideColorPalette}; with one list per surface, the `default` list. Pass
 * `{ optional: true }` - most apps provide none.
 */
export function injectColorPalette(): ColorPaletteEntry[];
export function injectColorPalette(options: InjectOptions & { optional?: false }): ColorPaletteEntry[];
export function injectColorPalette(options: InjectOptions): ColorPaletteEntry[] | null;
export function injectColorPalette(options?: InjectOptions): ColorPaletteEntry[] | null {
  const config = options ? injectColorPaletteConfig(options) : injectColorPaletteConfig();

  return config ? selectPalette(config, null) : null;
}

/**
 * The palette from {@link provideColorPalette} for the surface the current subtree renders on: that
 * surface theme's list, else the `default` list. `null` when no palette is provided.
 */
export const injectSurfaceColorPalette = (): Signal<ColorPaletteEntry[] | null> => {
  const config = injectColorPaletteConfig({ optional: true });
  const surface = injectParentSurface();

  return computed(() => (config ? selectPalette(config, surface()?.name ?? null) : null));
};

export const COLOR_PALETTE = /* @__PURE__ */ toToken(COLOR_PALETTE_DEF);
