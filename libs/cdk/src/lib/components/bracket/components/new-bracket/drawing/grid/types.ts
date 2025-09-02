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
  columnGap: number;
  upperLowerGap: number;
  rowGap: number;
  finalMatchHeight: number;
  finalColumnWidth: number;
  layout: BracketDataLayout;
};
