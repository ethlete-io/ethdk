import { BracketDataLayout } from '../../core';
import { FinalizedBracketColumn, FinalizedBracketMatchElementMap, MutableBracketGrid } from './core';

export type ComputedBracketGrid<TRoundData, TMatchData> = {
  raw: MutableBracketGrid<TRoundData, TMatchData>;
  columns: FinalizedBracketColumn<TRoundData, TMatchData>[];
  matchElementMap: FinalizedBracketMatchElementMap<TRoundData, TMatchData>;
};

export type CreateBracketGridConfig = {
  includeRoundHeaders: boolean;
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  roundHeaderGap: number;
  columnGap: number;
  rowRoundGap: number;
  rowGap: number;
  finalMatchHeight: number;
  finalColumnWidth: number;

  /**
   * How far below the top of the final's card a third place match sits, in px, when the two share a
   * column. Unset (or `null`) gives the third place a column of its own, except in a mirrored layout,
   * which folds it one `rowGap` below the final's card. Only used by single elimination.
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
