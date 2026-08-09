import { validate } from '@angular/forms/signals';

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
