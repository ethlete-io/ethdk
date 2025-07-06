import {
  BRACKET_ROUND_MIRROR_TYPE,
  BracketMatchId,
  BracketRoundId,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from './core';
import { BracketGridDefinitions } from './grid-definitions';
import { BracketGridRoundItem } from './grid-placements';
import { FIRST_ROUNDS_TYPE, FirstRounds } from './linked';

export type DrawManDimensions = {
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  columnGap: number;
  upperLowerGap: number;
  rowGap: number;
  gridDefinitions: BracketGridDefinitions;
  path: Omit<PathOptions, 'className'>;
  curve: Omit<CurveOptions, 'path' | 'inverted'>;
};

type PathOptions = {
  width: number;
  dashArray: number;
  dashOffset: number;
  className: string;
};

const path = (d: string, options: PathOptions) =>
  `<path d="${d.replace(/\s+/g, ' ').trim()}" stroke="currentColor" fill="none" stroke-width="${options.width}" stroke-dasharray="${options.dashArray}" stroke-dashoffset="${options.dashOffset}" class="${options.className}" />`;

type CurveOptions = {
  lineStartingCurveAmount: number;
  lineEndingCurveAmount: number;
  path: PathOptions;
  inverted?: boolean;
};

const curvePath = (from: BracketPosition, to: BracketPosition, direction: 'up' | 'down', options: CurveOptions) => {
  const inverted = options.inverted ?? false;

  // Inline/block coordinates depending on direction and inversion
  const fromInline = inverted ? from.inline.start : from.inline.end;
  const toInline = inverted ? to.inline.end : to.inline.start;
  const fromBlock = from.block.center;
  const toBlock = to.block.center;

  // Curve parameters
  const startCurve = options.lineStartingCurveAmount;
  const endCurve = options.lineEndingCurveAmount;
  const totalInline = Math.abs(toInline - fromInline);
  const straightLength = (totalInline - startCurve - endCurve) / 2;

  // Calculate key points for the path
  const straightEnd = inverted ? fromInline - straightLength : fromInline + straightLength;
  const straightStart = inverted ? toInline + straightLength : toInline - straightLength;

  // First curve (from start)
  const firstCurveEndX = inverted ? straightEnd - startCurve : straightEnd + startCurve;
  const firstCurveEndY = direction === 'down' ? fromBlock + startCurve : fromBlock - startCurve;

  // Second curve (to end)
  const secondCurveStartY = direction === 'down' ? toBlock - endCurve : toBlock + endCurve;
  const secondCurveEndX = straightStart;
  const secondCurveEndY = toBlock;
  const secondCurveBezierX = inverted ? straightStart + endCurve : straightStart - endCurve;

  // SVG path string
  const d = [
    `M ${fromInline} ${fromBlock}`,
    `H ${straightEnd}`,
    `Q ${firstCurveEndX} ${fromBlock}, ${firstCurveEndX} ${firstCurveEndY}`,
    `V ${secondCurveStartY}`,
    `Q ${secondCurveBezierX} ${toBlock}, ${secondCurveEndX} ${secondCurveEndY}`,
    `H ${toInline}`,
  ].join(' ');

  return path(d, options.path);
};

type LineOptions = {
  path: PathOptions;
};

const linePath = (from: BracketPosition, to: BracketPosition, options: LineOptions) => {
  return path(`M ${from.inline.end} ${from.block.center} L ${to.inline.start} ${to.block.center}`, options.path);
};

type StaticMeasurements = {
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
};

type BracketPosition = {
  inline: { start: number; end: number; center: number }; // the left, right and center of the match
  block: { start: number; end: number; center: number }; // the top, bottom and center of the match
};

const getMatchPosition = <TRoundData, TMatchData>(
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

export const drawMan = <TRoundData, TMatchData>(
  items: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>>,
  firstRounds: FirstRounds<TRoundData, TMatchData>,
  dimensions: DrawManDimensions,
) => {
  const { columnWidth, matchHeight, rowGap, columnGap, roundHeaderHeight } = dimensions;
  const roundHeaderRowGap = roundHeaderHeight ? rowGap : 0;
  const baseOffsetY = roundHeaderHeight + roundHeaderRowGap;

  const svgParts: string[] = [];

  for (const round of items.values()) {
    for (const item of round.items.values()) {
      if (item.type === 'round') continue; // we don't draw lines for round headers

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
        baseOffsetY,
        baseRoundMatchCount,
        columnGap,
        columnWidth,
        doubleEliminationMergeOffset,
        matchHeight,
        rowGap,
      };

      const currentMatchParticipantsShortIds = [
        item.matchRelation.currentMatch.home?.shortId,
        item.matchRelation.currentMatch.away?.shortId,
      ]
        .filter((id) => !!id)
        .join(' ');

      const pathOptions: PathOptions = { ...dimensions.path, className: currentMatchParticipantsShortIds };

      const currentMatchPosition = getMatchPosition(round, item.matchRelation.currentMatch.id, staticMeasurements);

      // We only draw the left side of the match relation
      switch (item.matchRelation.type) {
        case 'nothing-to-one': {
          continue;
        }
        case 'one-to-nothing':
        case 'one-to-one': {
          const previousMatchPosition = getMatchPosition(
            items.get(item.matchRelation.previousRound.id),
            item.matchRelation.previousMatch.id,
            staticMeasurements,
          );

          // draw a straight line
          svgParts.push(linePath(previousMatchPosition, currentMatchPosition, { path: pathOptions }));

          break;
        }

        case 'two-to-nothing':
        case 'two-to-one': {
          const previousUpper = getMatchPosition(
            items.get(item.matchRelation.previousUpperRound.id),
            item.matchRelation.previousUpperMatch.id,
            staticMeasurements,
          );

          const previousLower = getMatchPosition(
            items.get(item.matchRelation.previousLowerRound.id),
            item.matchRelation.previousLowerMatch.id,
            staticMeasurements,
          );

          const invertCurve = item.roundRelation.currentRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT;

          const curveOptions: CurveOptions = {
            ...dimensions.curve,
            inverted: invertCurve,
            path: { ...dimensions.path, className: '' },
          };

          // draw two lines that merge into one in the middle
          svgParts.push(
            curvePath(previousUpper, currentMatchPosition, 'down', {
              ...curveOptions,
              path: { ...curveOptions.path, className: item.matchRelation.previousUpperMatch.winner?.shortId || '' },
            }),
          );
          svgParts.push(
            curvePath(previousLower, currentMatchPosition, 'up', {
              ...curveOptions,
              path: { ...curveOptions.path, className: item.matchRelation.previousLowerMatch.winner?.shortId || '' },
            }),
          );

          if (
            item.matchRelation.currentRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT &&
            item.matchRelation.type === 'two-to-one' &&
            item.matchRelation.nextRound.mirrorRoundType === null
          ) {
            // draw a straight line for the special case of connecting the final match to the mirrored semi final match

            const next = getMatchPosition(
              items.get(item.matchRelation.nextRound.id),
              item.matchRelation.nextMatch.id,
              staticMeasurements,
            );

            svgParts.push(linePath(next, currentMatchPosition, { path: pathOptions }));
          }

          break;
        }
      }
    }
  }

  return svgParts.join('');
};
