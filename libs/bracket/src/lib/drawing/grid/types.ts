import { BracketDataLayout } from '../../core';
import { FinalizedBracketColumn, FinalizedBracketMatchElementMap, MutableBracketGrid } from './core';

export type ComputedBracketGrid<TRoundData, TMatchData> = {
  raw: MutableBracketGrid<TRoundData, TMatchData>;
  columns: FinalizedBracketColumn<TRoundData, TMatchData>[];
  matchElementMap: FinalizedBracketMatchElementMap<TRoundData, TMatchData>;
};

/** Returns the width needed to render a computed bracket grid without horizontal clipping. */
export const bracketGridNaturalWidth = <TRoundData, TMatchData>(
  grid: ComputedBracketGrid<TRoundData, TMatchData>,
): number => grid.raw.grid.dimensions.width;

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
   * column. Unset (or `null`) gives the third place a column of its own.
   */
  thirdPlaceTopOffset?: number | null;
  swissGroupPadding: number;
  swissGroupBorderWidth: number;
  layout: BracketDataLayout;
  continueElement?: {
    columnWidth: number;
    elementHeight: number;
  } | null;
};
