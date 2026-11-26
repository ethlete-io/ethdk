import { BracketDataLayout } from '../../core';
import { FinalizedBracketColumn, FinalizedBracketMatchElementMap, MutableBracketGrid } from './core';
import { BracketGridSection } from './sections';

export type ComputedBracketGrid<TRoundData, TMatchData> = {
  raw: MutableBracketGrid<TRoundData, TMatchData>;
  columns: FinalizedBracketColumn<TRoundData, TMatchData>[];
  matchElementMap: FinalizedBracketMatchElementMap<TRoundData, TMatchData>;
  /** The parts of the bracket and where they sit. Only the left-to-right double elimination grid sets it. */
  sections?: BracketGridSection<TRoundData, TMatchData>[];
  /** @internal Set when the finals were moved off the upper bracket final's row. */
  finalAlignment?: BracketFinalAlignment;
};

/** Returns the width needed to render a computed bracket grid without horizontal clipping. */
export const bracketGridNaturalWidth = <TRoundData, TMatchData>(
  grid: ComputedBracketGrid<TRoundData, TMatchData>,
): number => grid.raw.grid.dimensions.width;

export const BRACKET_FINAL_ALIGNMENT = {
  UPPER: 'upper',
  CENTER: 'center',
} as const;

/**
 * Where a left-to-right double elimination puts its finals: `'upper'` level with the upper bracket final,
 * `'center'` on the midpoint between the centres of the upper bracket final and the lower bracket final.
 */
export type BracketFinalAlignment = (typeof BRACKET_FINAL_ALIGNMENT)[keyof typeof BRACKET_FINAL_ALIGNMENT];

export type CreateBracketGridConfig = {
  includeRoundHeaders: boolean;
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  roundHeaderGap: number;
  columnGap: number;
  rowRoundGap: number;
  rowGap: number;
  rowSpanRoundId: string | null;
  /** @internal Resolved by a grid builder from `rowSpanRoundId`. */
  rowSpanMatchCount?: number;
  finalMatchHeight: number;
  finalColumnWidth: number;

  /**
   * What the final keeps between its round header and its card, in px, where that is more than
   * `roundHeaderGap`. The room goes to the final's column alone. Unset gives it the same gap as every
   * other round.
   */
  finalRoundHeaderGap?: number | null;

  /**
   * How far below the top of the final's card a third place match sits, in px, when the two share a
   * column. Unset (or `null`) gives the third place a column of its own, except in a mirrored layout,
   * which folds it one `rowGap` below the final's card.
   */
  thirdPlaceTopOffset?: number | null;
  swissGroupPadding: number;
  swissGroupBorderWidth: number;

  /**
   * The band reserved above each section for its title, in px. Only the left-to-right double elimination
   * grid reserves it; unset or `0` reserves none.
   */
  sectionTitleHeight?: number;

  /**
   * Where the left-to-right double elimination grid puts the final and the bracket reset, see
   * {@link BracketFinalAlignment}. Unset means `'upper'`; a centred final never overlaps a third place below it.
   */
  finalAlignment?: BracketFinalAlignment;
  layout: BracketDataLayout;
  continueElement?: {
    columnWidth: number;
    elementHeight: number;
  } | null;
};
