export const COLOR_NOTATIONS = {
  HEX: 'hex',
  RGB: 'rgb',
  HSL: 'hsl',
} as const;

/**
 * A notation the color picker can display and read. It never changes what the control emits - the
 * value stays lowercase hex (`#rrggbb`, `#rrggbbaa` with `alpha`) in every notation.
 */
export type ColorNotation = (typeof COLOR_NOTATIONS)[keyof typeof COLOR_NOTATIONS];

/** The order the picker offers notations in, and the default set. */
export const COLOR_NOTATION_ORDER = [COLOR_NOTATIONS.HEX, COLOR_NOTATIONS.RGB, COLOR_NOTATIONS.HSL] as const;
