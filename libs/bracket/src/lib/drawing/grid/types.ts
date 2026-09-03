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
  swissGroupPadding: number;
  swissGroupBorderWidth: number;
  layout: BracketDataLayout;
  continueElement?: {
    columnWidth: number;
    elementHeight: number;
  } | null;
};
