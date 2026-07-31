import { TOURNAMENT_MODE, TournamentMode } from './tournament';

export const canRenderLayoutInTournamentMode = (layout: BracketDataLayout, mode: TournamentMode) => {
  switch (mode) {
    case TOURNAMENT_MODE.SINGLE_ELIMINATION:
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT || layout === BRACKET_DATA_LAYOUT.MIRRORED;
    default:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
  }
};

export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  /**
   * Folded in half: each round that can be halved is drawn twice, once on each side, converging on the
   * rounds too small to halve. Halves the height and roughly doubles the width, which is what a poster
   * or a broadcast graphic wants.
   *
   * Elimination brackets only. A swiss stage has no fold to make — it throws `ET3400`.
   */
  MIRRORED: 'mirrored',
} as const;

export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];
