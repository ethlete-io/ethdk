export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  /**
   * Folded in half: each round up to the first one too small to halve is drawn twice, once on each
   * side, converging on that round and the ones after it. Halves the height and roughly doubles the
   * width, which is what a poster or a broadcast graphic wants.
   *
   * Carried by the mirrored layout factories - a layout that has no fold to make (swiss) simply has no
   * mirrored variant.
   */
  MIRRORED: 'mirrored',
} as const;

export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];
