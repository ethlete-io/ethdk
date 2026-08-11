import { defineStaticProvider, toInjectFn, toProvideFn, toToken } from '../utils';
import { RegisteredColorThemeName } from './color-theme.util';

/** One choice in a {@link provideColorPalette} palette. */
export type ColorPaletteEntry = {
  /** The color theme this choice selects - a name the app registered with `provideColorThemesWithTailwind4`. */
  token: RegisteredColorThemeName;
  /** What a user reads next to the swatch. Provide it already translated. */
  label: string;
};

const COLOR_PALETTE_DEF = /* @__PURE__ */ defineStaticProvider<ColorPaletteEntry[]>(undefined, {
  name: 'Color Palette',
});

/**
 * The color themes a subtree may offer a user as pickable choices, in the order they should appear.
 * A curated slice of what `provideColorThemesWithTailwind4` registered: an app registers every theme
 * it renders with, including ones nobody should pick by hand (`error`, `warning`), and adds the
 * user-facing label a swatch needs.
 *
 * Components that let a user choose a color read it optionally and fall back to accepting a raw
 * theme name when it is absent - the scheduler's `colorToken` field is the reference consumer.
 *
 * @example
 * provideColorPalette([
 *   { token: 'brand', label: 'Team green' },
 *   { token: 'ocean', label: 'Training blue' },
 * ]);
 */
export const provideColorPalette = /* @__PURE__ */ toProvideFn(COLOR_PALETTE_DEF);

/** The palette from {@link provideColorPalette}. Pass `{ optional: true }` - most apps provide none. */
export const injectColorPalette = /* @__PURE__ */ toInjectFn(COLOR_PALETTE_DEF);

export const COLOR_PALETTE = /* @__PURE__ */ toToken(COLOR_PALETTE_DEF);
