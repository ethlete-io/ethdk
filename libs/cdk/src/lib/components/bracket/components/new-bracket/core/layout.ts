import { TOURNAMENT_MODE, TournamentMode } from './tournament';

export const canRenderLayoutInTournamentMode = (layout: BracketDataLayout, mode: TournamentMode): boolean => {
  switch (mode) {
    case TOURNAMENT_MODE.SINGLE_ELIMINATION:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT || layout === BRACKET_DATA_LAYOUT.MIRRORED;
    default:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
  }
};

export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  // Currently only supported in single elimination brackets. Will throw an error if used in other bracket types
  MIRRORED: 'mirrored',
} as const;

export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];
