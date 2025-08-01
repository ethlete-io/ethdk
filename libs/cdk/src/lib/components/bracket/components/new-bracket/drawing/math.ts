import { BracketMatchId, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { BracketGridMatchItem, BracketGridRoundItem } from '../grid-placements';
import { FIRST_ROUNDS_TYPE, FirstRounds } from '../linked';
import { DrawManDimensions } from './draw-man';

export type StaticMeasurements = {
  /** Width of one column */
  columnWidth: number;

  /** Height of one match */
  matchHeight: number;

  /** Gap between rows */
  rowGap: number;

  /** Gap between columns */
  columnGap: number;

  /**
   * Offset from the top.
   * Will be 0 if e.g. there is no round header and we are displaying a single elimination bracket.
   * Will be some value if there is a round header or if we want to display the lower bracket of a double elimination bracket.
   */
  baseOffsetY: number;

  /**
   * The number of matches in the first round.
   * For double elimination brackets, this is the number of matches in the upper bracket or the lower bracket.
   * For double elimination matches after the upper and lower bracket have been merged, this is the sum of matches in the first round of the upper and lower bracket.
   */
  baseRoundMatchCount: number;

  /**
   * Will be round header height + row gap if we are merging the upper and lower bracket of a double elimination bracket, 0 otherwise.
   * This value will be added to the available whitespace for the match to be displayed in the middle of.
   */
  doubleEliminationMergeOffset: number;

  /** Gap between the upper and lower bracket in a double elimination bracket */
  upperLowerGap: number;
};

export const calcStaticMeasurements = <TRoundData, TMatchData>(
  item: BracketGridMatchItem<TRoundData, TMatchData>,
  firstRounds: FirstRounds<TRoundData, TMatchData>,
  dimensions: DrawManDimensions,
) => {
  const { columnWidth, matchHeight, rowGap, columnGap, roundHeaderHeight, upperLowerGap } = dimensions;
  const roundHeaderRowGap = roundHeaderHeight ? rowGap : 0;
  const baseOffsetY = roundHeaderHeight + roundHeaderRowGap;

  let baseRoundMatchCount: number | null = null;
  let doubleEliminationMergeOffset = 0;

  if (firstRounds.type === FIRST_ROUNDS_TYPE.SINGLE) {
    baseRoundMatchCount = firstRounds.first.matchCount;
  } else {
    if (item.roundRelation.currentRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET) {
      baseRoundMatchCount = firstRounds.upper.matchCount;
    } else if (item.roundRelation.currentRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET) {
      baseRoundMatchCount = firstRounds.lower.matchCount;
    } else {
      baseRoundMatchCount = firstRounds.upper.matchCount + firstRounds.lower.matchCount;
    }
  }

  if (item.roundRelation.currentRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET) {
    doubleEliminationMergeOffset = roundHeaderHeight + roundHeaderRowGap;
    // TODO:
    // baseOffsetY = baseOffsetY * 2 (2 round headers and gaps) + (firstRounds.upper.matchCount * matchHeight) + (firstRounds.upper.matchCount - 1 * rowGap)
    // baseOffsetY
  }

  const staticMeasurements: StaticMeasurements = {
    upperLowerGap,
    baseOffsetY,
    baseRoundMatchCount,
    columnGap,
    columnWidth,
    doubleEliminationMergeOffset,
    matchHeight,
    rowGap,
  };

  return staticMeasurements;
};

export type BracketPosition = {
  inline: { start: number; end: number; center: number }; // the left, right and center of the match
  block: { start: number; end: number; center: number }; // the top, bottom and center of the match
};

export const getMatchPosition = <TRoundData, TMatchData>(
  roundItem: BracketGridRoundItem<TRoundData, TMatchData> | undefined,
  matchId: BracketMatchId | undefined,
  staticMeasurements: StaticMeasurements,
): BracketPosition => {
  if (!roundItem) throw new Error('Item is missing');
  if (!matchId) throw new Error('Match is missing');

  const match = roundItem.items.get(matchId);

  if (!match || match.type !== 'match') throw new Error('Match is missing');

  const matchHalf = staticMeasurements.matchHeight / 2;

  const roundFactor = staticMeasurements.baseRoundMatchCount / roundItem.roundRelation.currentRound.matchCount;
  const remainingRowGapCount = roundItem.roundRelation.currentRound.matchCount - 1;
  const matchIncludedRowGapTotal = staticMeasurements.baseRoundMatchCount - 1 - remainingRowGapCount;
  const matchIncludedRowGapPerMatch = matchIncludedRowGapTotal / roundItem.roundRelation.currentRound.matchCount;
  const matchRoundItemHeight =
    staticMeasurements.matchHeight * roundFactor + matchIncludedRowGapPerMatch * staticMeasurements.rowGap;

  const matchesAbove = match.matchRelation.currentMatch.indexInRound;
  const rowOffset = matchesAbove * staticMeasurements.rowGap + matchesAbove * matchRoundItemHeight;

  const matchRowOffset = (matchRoundItemHeight - staticMeasurements.matchHeight) / 2;

  const blockStart =
    rowOffset + matchRowOffset + staticMeasurements.baseOffsetY + staticMeasurements.doubleEliminationMergeOffset;

  const block = {
    start: blockStart,
    end: blockStart + staticMeasurements.matchHeight,
    center: blockStart + matchHalf,
  };

  const inlineStart =
    (roundItem.columnStart - 1) * staticMeasurements.columnWidth +
    (roundItem.columnStart - 1) * staticMeasurements.columnGap;

  const inline = {
    start: inlineStart,
    end: inlineStart + staticMeasurements.columnWidth,
    center: inlineStart + staticMeasurements.columnWidth / 2,
  };

  return { inline, block };
};
