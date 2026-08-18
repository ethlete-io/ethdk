/** An sRGB color. Channels are 0-255 integers; `alpha` is 0-1. */
export type RgbColor = {
  red: number;
  green: number;
  blue: number;
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

/**
 * Reads any notation the color validators accept - `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and
 * `rgb()`/`rgba()` in the comma or the space form - into channels plus alpha. Returns `null` for a
 * blank or unparseable value.
 */
export const parseColorToRgb = (value: string | null | undefined): RgbColor | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = value.trim();

  if (!raw.length) {
    return null;
  }

  return HEX_PATTERN.test(raw) ? parseHex(raw) : parseFunctionalRgb(raw.toLowerCase());
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
