import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings the color picker panel renders itself. */
export type ColorInputLabels = {
  /** Accessible name of the picker overlay. */
  dialog: string;
  /** Accessible name of the button that opens the picker. */
  pickerTrigger: string;
  /** Accessible name of the two-dimensional saturation and brightness surface. */
  area: string;
  /** Accessible name of the saturation slider inside that surface. */
  saturation: string;
  /** Accessible name of the brightness slider inside that surface. */
  brightness: string;
  /** Accessible name of the hue track. */
  hue: string;
  /** Accessible name of the opacity track. */
  alpha: string;
  /** Label of the hex entry field inside the panel. */
  hex: string;
  /** Accessible name of the preset swatch group. */
  swatches: string;
  /** Accessible name of the button that samples a color from the screen. */
  eyedropper: string;
};

/** The built-in English labels. */
export const DEFAULT_COLOR_INPUT_LABELS: ColorInputLabels = {
  dialog: 'Choose a color',
  pickerTrigger: 'Choose a color',
  area: 'Saturation and brightness',
  saturation: 'Saturation',
  brightness: 'Brightness',
  hue: 'Hue',
  alpha: 'Opacity',
  hex: 'Hex',
  swatches: 'Preset colors',
  eyedropper: 'Pick a color from the screen',
};

const COLOR_INPUT_LABELS_DEF = /* @__PURE__ */ defineLabels<ColorInputLabels>(
  'COLOR_INPUT_LABELS',
  DEFAULT_COLOR_INPUT_LABELS,
);

/**
 * Localize the color picker's strings for everything below this injector, and read the set in
 * effect here as a signal. Partial - whatever you leave out keeps its
 * {@link DEFAULT_COLOR_INPUT_LABELS} value.
 *
 * @example
 * provideColorInputLabels({ hue: 'Farbton', hex: 'Hex' });
 */
export const provideColorInputLabels = /* @__PURE__ */ toProvideFn(COLOR_INPUT_LABELS_DEF);
export const injectColorInputLabels = /* @__PURE__ */ toInjectFn(COLOR_INPUT_LABELS_DEF);
export const COLOR_INPUT_LABELS = /* @__PURE__ */ toToken(COLOR_INPUT_LABELS_DEF);
