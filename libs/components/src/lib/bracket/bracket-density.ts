import { BracketLayoutConfig } from './bracket.config';

export const BRACKET_DENSITY = {
  /** The shipped sizing: a 250px column with room for emblems, names and a score. */
  DEFAULT: 'default',
  /** Roughly two thirds the size, for a full bracket inside an article column or a phone. */
  COMPACT: 'compact',
} as const;

export type BracketDensity = (typeof BRACKET_DENSITY)[keyof typeof BRACKET_DENSITY];

/**
 * What a density is: a set of layout defaults, applied under anything you set yourself.
 *
 * `compact`'s column is deliberately under the match card's own 150px minimal threshold, so the cards
 * inside it drop their emblems and shrink their type without the bracket having to say so — one number
 * here changes the whole look. The curves come down with the columns: a 10px radius on a 40px connector
 * reads as a kink rather than a curve.
 */
export const BRACKET_DENSITY_PRESETS: Record<BracketDensity, Partial<BracketLayoutConfig>> = {
  [BRACKET_DENSITY.DEFAULT]: {},
  [BRACKET_DENSITY.COMPACT]: {
    columnWidth: 140,
    matchHeight: 52,
    finalColumnWidth: 200,
    finalMatchHeight: 132,
    roundHeaderHeight: 34,
    roundHeaderGap: 12,
    columnGap: 32,
    rowGap: 16,
    rowRoundGap: 12,
    lineStartingCurveAmount: 6,
    continueColumnWidth: 140,
    continueElementHeight: 52,
    swissGroupPadding: 6,
  },
};
