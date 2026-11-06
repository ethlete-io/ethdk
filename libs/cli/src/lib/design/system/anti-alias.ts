const ANTI_ALIAS_TOLERANCE = 8;

/** `true` when any channel of two RGBA pixels (as 32-bit words) differs by more than 8 of 255; a smaller shift is anti-alias, no change. */
export const pixelsDiffer = (a: number, b: number) =>
  Math.abs((a >>> 24) - (b >>> 24)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs((a & 255) - (b & 255)) > ANTI_ALIAS_TOLERANCE;
