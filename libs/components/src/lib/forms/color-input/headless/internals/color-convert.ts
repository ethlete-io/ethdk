import { COLOR_NOTATIONS, ColorNotation } from '../../color-input.types';

/** An sRGB color. Channels are 0-255 integers; `alpha` is 0-1. */
export type RgbColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

/** An HSL color. `hue` is 0-360; `saturation`, `lightness` and `alpha` are 0-1. */
export type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
};

/** An HSV color. `hue` is 0-360; `saturation`, `value` and `alpha` are 0-1. */
export type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
  alpha: number;
};

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Both the comma form and the space form, because either is what a user pastes out of devtools.
// The channels are range-checked below rather than in the pattern, which would be unreadable.
const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

const HSL_PATTERN =
  /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseAlphaComponent = (raw: string | undefined) => {
  if (raw === undefined) {
    return 1;
  }

  const isPercentage = raw.endsWith('%');
  const numeric = Number(isPercentage ? raw.slice(0, -1) : raw);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clamp01(isPercentage ? numeric / 100 : numeric);
};

const parseHex = (raw: string): RgbColor => {
  const digits = raw.slice(1);
  const expanded = digits.length <= 4 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const channelAt = (index: number) => parseInt(expanded.slice(index * 2, index * 2 + 2), 16);

  return {
    red: channelAt(0),
    green: channelAt(1),
    blue: channelAt(2),
    alpha: expanded.length === 8 ? channelAt(3) / 255 : 1,
  };
};

const parseFunctionalRgb = (raw: string): RgbColor | null => {
  const match = RGB_PATTERN.exec(raw);

  if (!match) {
    return null;
  }

  const [, rawRed, rawGreen, rawBlue, rawAlpha] = match;
  const red = Number(rawRed);
  const green = Number(rawGreen);
  const blue = Number(rawBlue);

  if (red > 255 || green > 255 || blue > 255) {
    return null;
  }

  const alpha = parseAlphaComponent(rawAlpha);

  if (alpha === null) {
    return null;
  }

  return { red, green, blue, alpha };
};

const parseFunctionalHsl = (raw: string): RgbColor | null => {
  const match = HSL_PATTERN.exec(raw);

  if (!match) {
    return null;
  }

  const [, rawHue, rawSaturation, rawLightness, rawAlpha] = match;
  const saturation = Number(rawSaturation) / 100;
  const lightness = Number(rawLightness) / 100;

  if (saturation > 1 || lightness > 1) {
    return null;
  }

  const alpha = parseAlphaComponent(rawAlpha);

  if (alpha === null) {
    return null;
  }

  return hslToRgb({ hue: Number(rawHue), saturation, lightness, alpha });
};

/**
 * Reads any notation the color validators accept - `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, plus
 * `rgb()`/`rgba()` and `hsl()`/`hsla()` in the comma or the space form - into channels plus alpha.
 * Returns `null` for a blank or unparseable value.
 */
export const parseColorToRgb = (value: string | null | undefined): RgbColor | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = value.trim();

  if (!raw.length) {
    return null;
  }

  if (HEX_PATTERN.test(raw)) {
    return parseHex(raw);
  }

  const lowered = raw.toLowerCase();

  return lowered.startsWith('hsl') ? parseFunctionalHsl(lowered) : parseFunctionalRgb(lowered);
};

/** Which notation a raw entry is written in, or `null` when nothing can read it. */
export const detectColorNotation = (value: string | null | undefined): ColorNotation | null => {
  if (!parseColorToRgb(value)) {
    return null;
  }

  const raw = (value as string).trim().toLowerCase();

  if (raw.startsWith('hsl')) {
    return COLOR_NOTATIONS.HSL;
  }

  return raw.startsWith('rgb') ? COLOR_NOTATIONS.RGB : COLOR_NOTATIONS.HEX;
};

/**
 * Converts to HSV. **A grey returns `hue` 0 and a black returns `saturation` 0**: those readings do
 * not exist in the source color, so a caller that round-trips through this loses the hue the user
 * was on. Hold the HSV state yourself for as long as the user is dragging, and convert one way only.
 */
export const rgbToHsv = (rgb: RgbColor): HsvColor => {
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const span = max - min;

  let hue = 0;

  if (span > 0) {
    if (max === red) {
      hue = ((green - blue) / span) % 6;
    } else if (max === green) {
      hue = (blue - red) / span + 2;
    } else {
      hue = (red - green) / span + 4;
    }

    hue *= 60;

    if (hue < 0) {
      hue += 360;
    }
  }

  return {
    hue,
    saturation: max === 0 ? 0 : span / max,
    value: max,
    alpha: rgb.alpha,
  };
};

export const hsvToRgb = (hsv: HsvColor): RgbColor => {
  const hue = ((hsv.hue % 360) + 360) % 360;
  const saturation = clamp01(hsv.saturation);
  const value = clamp01(hsv.value);

  const sector = hue / 60;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = value - chroma;

  const rotations = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ] as const;

  const [red, green, blue] = rotations[Math.min(5, Math.floor(sector))] ?? rotations[0];

  return {
    red: Math.round((red + base) * 255),
    green: Math.round((green + base) * 255),
    blue: Math.round((blue + base) * 255),
    alpha: clamp01(hsv.alpha),
  };
};

const toHexPair = (channel: number) =>
  Math.min(255, Math.max(0, Math.round(channel)))
    .toString(16)
    .padStart(2, '0');

/**
 * Formats as lowercase `#rrggbb`, or `#rrggbbaa` when `alpha` is on - the notation the control
 * emits and the strict `hexColor()` validator accepts.
 */
export const formatRgbToHex = (rgb: RgbColor, options?: { alpha?: boolean }) => {
  const base = `#${toHexPair(rgb.red)}${toHexPair(rgb.green)}${toHexPair(rgb.blue)}`;

  return options?.alpha ? `${base}${toHexPair(rgb.alpha * 255)}` : base;
};

export const parseColorToHsv = (value: string | null | undefined): HsvColor | null => {
  const rgb = parseColorToRgb(value);

  return rgb ? rgbToHsv(rgb) : null;
};

export const formatHsvToHex = (hsv: HsvColor, options?: { alpha?: boolean }) => formatRgbToHex(hsvToRgb(hsv), options);

/** The fully saturated, fully bright color at `hue`, for a picker track or area gradient stop. */
export const hueToCssColor = (hue: number) => `hsl(${((hue % 360) + 360) % 360} 100% 50%)`;

const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360;

export const hslToRgb = (hsl: HslColor): RgbColor => {
  const hue = normalizeHue(hsl.hue);
  const saturation = clamp01(hsl.saturation);
  const lightness = clamp01(hsl.lightness);

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const base = lightness - chroma / 2;

  const rotations = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ] as const;

  const [red, green, blue] = rotations[Math.min(5, Math.floor(segment))] ?? rotations[0];

  return {
    red: Math.round((red + base) * 255),
    green: Math.round((green + base) * 255),
    blue: Math.round((blue + base) * 255),
    alpha: clamp01(hsl.alpha),
  };
};

export const rgbToHsl = (rgb: RgbColor): HslColor => {
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const span = max - min;
  const lightness = (max + min) / 2;

  const saturation = span === 0 ? 0 : span / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;

  if (span !== 0) {
    if (max === red) {
      hue = ((green - blue) / span) % 6;
    } else if (max === green) {
      hue = (blue - red) / span + 2;
    } else {
      hue = (red - green) / span + 4;
    }
  }

  return { hue: normalizeHue(hue * 60), saturation, lightness, alpha: clamp01(rgb.alpha) };
};

const formatAlphaComponent = (alpha: number) => Math.round(clamp01(alpha) * 100) / 100;

/** Formats as `rgb(r g b)`, or `rgb(r g b / a)` when `alpha` is on. */
export const formatRgb = (rgb: RgbColor, options?: { alpha?: boolean }) => {
  const channels = `${Math.round(rgb.red)} ${Math.round(rgb.green)} ${Math.round(rgb.blue)}`;

  return options?.alpha ? `rgb(${channels} / ${formatAlphaComponent(rgb.alpha)})` : `rgb(${channels})`;
};

/** Formats as `hsl(h s% l%)`, or `hsl(h s% l% / a)` when `alpha` is on. */
export const formatHsl = (rgb: RgbColor, options?: { alpha?: boolean }) => {
  const hsl = rgbToHsl(rgb);
  const channels = `${Math.round(hsl.hue)} ${Math.round(hsl.saturation * 100)}% ${Math.round(hsl.lightness * 100)}%`;

  return options?.alpha ? `hsl(${channels} / ${formatAlphaComponent(hsl.alpha)})` : `hsl(${channels})`;
};

/** Formats an HSV working color in one of the notations the picker offers. */
export const formatHsvToNotation = (hsv: HsvColor, options: { notation: ColorNotation; alpha?: boolean }) => {
  const rgb = hsvToRgb(hsv);

  if (options.notation === COLOR_NOTATIONS.RGB) {
    return formatRgb(rgb, options);
  }

  return options.notation === COLOR_NOTATIONS.HSL ? formatHsl(rgb, options) : formatRgbToHex(rgb, options);
};
