import { FieldContext, LogicFn, validate } from '@angular/forms/signals';
import { FieldWarning, warn } from '../form-field/headless';
import { parseColorToRgb } from './headless/internals/color-convert';

/** The path type `validate` accepts for a color field. Derived so we don't depend on a non-exported
 *  path type name from `@angular/forms/signals`. */
type ColorFieldPath = Parameters<typeof validate<string | null>>[0];

export type HexColorOptions = {
  /** Also accept the three-digit form (`#f00`), and `#f00c` when `allowAlpha` is on. @default false */
  allowShorthand?: boolean;
  /** Also accept a trailing alpha pair (`#ff0000cc`). @default false */
  allowAlpha?: boolean;
  /** Overrides the default "Enter a color as …" message. */
  message?: string;
};

export type RgbColorOptions = {
  /** Also accept `rgba(…)` and a fourth alpha component. @default false */
  allowAlpha?: boolean;
  /** Overrides the default "Enter a color as …" message. */
  message?: string;
};

export type ColorContrastOptions = {
  /** The color to measure against: another color field's path, or a fixed color string. */
  against: ColorFieldPath | string;
  /**
   * The contrast ratio the pair has to reach, as the `n` in `n:1`, or a function returning it - the
   * same shape signal forms' own `min()` takes, so the requirement can follow another field (a
   * "large text" switch relaxing 4.5 to 3). See {@link WCAG_CONTRAST_RATIOS}.
   * @default 4.5
   */
  min?: number | LogicFn<string | null, number>;
  /**
   * `'error'` fails the field and blocks `submit()`; `'warning'` reports through {@link warn}, which
   * leaves the field valid.
   * @default 'error'
   */
  severity?: 'error' | 'warning';
  /** Overrides the default "Contrast is …" message. */
  message?: string;
};

const HEX_PATTERNS = {
  strict: /^#[0-9a-f]{6}$/i,
  shorthand: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
  alpha: /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i,
  shorthandAlpha: /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
};

// Both the legacy comma form and the modern space form, since either is what a user pastes out of
// devtools. Alpha may be a number or a percentage; the channels are range-checked below, because a
// pattern that also enforced 0-255 would be unreadable.
const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

const isBlank = (value: string | null): value is null => value === null || value.trim().length === 0;

type RgbChannels = readonly [red: number, green: number, blue: number];

// getColorContrastRatio's documented contract (below) covers hex and rgb()/rgba() only, so hsl()
// is rejected explicitly rather than falling through to parseColorToRgb, which the picker itself
// uses and which does read it.
const parseColor = (value: string | null): RgbChannels | null => {
  if (isBlank(value)) return null;

  const raw = value.trim();

  if (raw.toLowerCase().startsWith('hsl')) return null;

  const rgb = parseColorToRgb(raw);

  return rgb ? [rgb.red, rgb.green, rgb.blue] : null;
};

const linearize = (channel: number) => {
  const srgb = channel / 255;

  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ([red, green, blue]: RgbChannels) =>
  0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);

/** The ratios WCAG 2.2 asks for, so a call site can name the rule instead of repeating the number. */
export const WCAG_CONTRAST_RATIOS = {
  /** 1.4.3 Contrast (Minimum), text under 18.66px / 24px bold. */
  aaNormal: 4.5,
  /** 1.4.3 Contrast (Minimum), text at or above 18.66px / 24px bold. */
  aaLarge: 3,
  /** 1.4.6 Contrast (Enhanced), text under 18.66px / 24px bold. */
  aaaNormal: 7,
  /** 1.4.6 Contrast (Enhanced), text at or above 18.66px / 24px bold. */
  aaaLarge: 4.5,
  /** 1.4.11 Non-text Contrast: icons, control borders, focus rings, chart marks. */
  nonText: 3,
} as const;

/**
 * The WCAG contrast ratio between two colors, as the `n` in `n:1` - 1 for a color against itself,
 * 21 for black against white. Accepts hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) and functional
 * `rgb()`/`rgba()` in either the comma or the space form, and returns `null` if either color is
 * blank or unparseable.
 *
 * **Alpha is ignored**: the result is for the two colors at full opacity, because compositing a
 * translucent color needs a backdrop this function is not given.
 *
 * ```ts
 * getColorContrastRatio('#767676', '#ffffff'); // 4.54
 * ```
 */
export const getColorContrastRatio = (color: string | null, other: string | null): number | null => {
  const first = parseColor(color);
  const second = parseColor(other);

  if (!first || !second) return null;

  const luminances = [relativeLuminance(first), relativeLuminance(second)];
  const lighter = Math.max(...luminances);
  const darker = Math.min(...luminances);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Signal-forms validator: fails the field unless the value is a hex color. Strict `#rrggbb` by
 * default - the notation `et-color-input` itself produces and documents - so a value that arrived
 * from an API or a `patchValue` rather than the picker still has to meet the contract.
 *
 * An empty or `null` value passes; pair it with `required()` if the field is mandatory.
 *
 * ```ts
 * form(model, (s) => {
 *   hexColor(s.brandColor);
 *   hexColor(s.overlayTint, { allowAlpha: true });
 * });
 * ```
 */
export const hexColor = (path: ColorFieldPath, { allowShorthand, allowAlpha, message }: HexColorOptions = {}) =>
  validate(path, ({ value }) => {
    const raw = value();

    if (isBlank(raw)) return undefined;

    const pattern = allowShorthand
      ? allowAlpha
        ? HEX_PATTERNS.shorthandAlpha
        : HEX_PATTERNS.shorthand
      : allowAlpha
        ? HEX_PATTERNS.alpha
        : HEX_PATTERNS.strict;

    if (pattern.test(raw.trim())) return undefined;

    const expected = [
      '#rrggbb',
      allowShorthand ? '#rgb' : null,
      allowAlpha ? '#rrggbbaa' : null,
      allowShorthand && allowAlpha ? '#rgba' : null,
    ].filter((notation) => notation !== null);

    return { kind: 'hexColor', message: message ?? `Enter a color as ${expected.join(' or ')}` };
  });

/**
 * Signal-forms validator: fails the field unless the value is a functional `rgb()` color, in either
 * the comma or the space form, with each channel in 0-255. For a control or an API that hands you
 * `rgb(255 0 0)` rather than hex - `et-color-input`'s own value is hex, so reach for
 * {@link hexColor} there.
 *
 * An empty or `null` value passes; pair it with `required()` if the field is mandatory.
 *
 * ```ts
 * form(model, (s) => {
 *   rgbColor(s.overlayTint, { allowAlpha: true });
 * });
 * ```
 */
export const rgbColor = (path: ColorFieldPath, { allowAlpha, message }: RgbColorOptions = {}) =>
  validate(path, ({ value }) => {
    const raw = value();

    if (isBlank(raw)) return undefined;

    const fail = {
      kind: 'rgbColor',
      message: message ?? `Enter a color as ${allowAlpha ? 'rgb(r g b) or rgba(r g b / a)' : 'rgb(r g b)'}`,
    };

    const match = RGB_PATTERN.exec(raw.trim());

    if (!match) return fail;

    const [, red, green, blue, alpha] = match;

    if (alpha !== undefined && !allowAlpha) return fail;

    const inRange = [red, green, blue].every((channel) => Number(channel) <= 255);

    return inRange ? undefined : fail;
  });

/**
 * Signal-forms rule: reports the field while its color does not reach `min` contrast against
 * another color - a second field of the same form (`against: s.background`) or a fixed color
 * (`against: '#ffffff'`). The one cross-field rule the library ships; `validate`'s context resolves
 * the other path, so the two fields need no wiring beyond sharing a `form()`.
 *
 * `severity: 'warning'` routes the same check through {@link warn} instead, which leaves the field
 * valid and lets `submit()` through - the right choice when the color is a brand decision rather
 * than a rule. Either way it reports `kind: 'colorContrast'`.
 *
 * Passes while **either** color is blank or unparseable, so it never doubles up on `required()` or
 * on {@link hexColor}. Alpha is ignored - see {@link getColorContrastRatio}.
 *
 * ```ts
 * form(model, (s) => {
 *   colorContrast(s.textColor, { against: s.backgroundColor });
 *   colorContrast(s.iconColor, { against: s.backgroundColor, min: WCAG_CONTRAST_RATIOS.nonText });
 *   colorContrast(s.brandColor, { against: '#ffffff', severity: 'warning' });
 *   colorContrast(s.headingColor, {
 *     against: s.backgroundColor,
 *     min: ({ valueOf }) => (valueOf(s.largeText) ? WCAG_CONTRAST_RATIOS.aaLarge : WCAG_CONTRAST_RATIOS.aaNormal),
 *   });
 * });
 * ```
 */
export const colorContrast = (
  path: ColorFieldPath,
  { against, min = WCAG_CONTRAST_RATIOS.aaNormal, severity = 'error', message }: ColorContrastOptions,
) => {
  const check = (ctx: FieldContext<string | null>): FieldWarning | null => {
    const other = typeof against === 'string' ? against : ctx.valueOf(against);
    const ratio = getColorContrastRatio(ctx.value(), other);
    const required = typeof min === 'number' ? min : min(ctx);

    if (ratio === null || ratio >= required) return null;

    // Floored, not rounded: a 4.49 reported as "4.5:1, needs at least 4.5:1" reads as a bug.
    const measured = Math.floor(ratio * 100) / 100;

    return { kind: 'colorContrast', message: message ?? `Contrast is ${measured}:1, needs at least ${required}:1` };
  };

  if (severity === 'warning') {
    warn(path, check);

    return;
  }

  validate(path, (ctx) => check(ctx) ?? undefined);
};
