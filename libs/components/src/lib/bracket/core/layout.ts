export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  /**
   * Folded in half: each round that can be halved is drawn twice, once on each side, converging on the
   * rounds too small to halve. Halves the height and roughly doubles the width, which is what a poster
   * or a broadcast graphic wants.
   *
   * Carried by the mirrored layout factories — a layout that has no fold to make (swiss) simply has no
   * mirrored variant.
   */
  MIRRORED: 'mirrored',
} as const;

export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];
