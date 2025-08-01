import {
  BRACKET_ROUND_MIRROR_TYPE,
  BracketMatchId,
  BracketRoundId,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../core';
import { BracketGridDefinitions } from '../grid-definitions';
import { BracketGridRoundItem } from '../grid-placements';
import { FirstRounds } from '../linked';
import { CurveOptions, curvePath } from './curve';
import { linePath } from './line';
import { BracketPosition, calcStaticMeasurements, getMatchPosition, StaticMeasurements } from './math';
import { PathOptions } from './path';

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

export const drawMan = <TRoundData, TMatchData>(
  items: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>>,
  firstRounds: FirstRounds<TRoundData, TMatchData>,
  dimensions: DrawManDimensions,
) => {
  const svgParts: string[] = [];
  const debugMap: Record<
    BracketMatchId,
    {
      position: BracketPosition;
      staticMeasurements: StaticMeasurements;
    }
  > = {};

  for (const round of items.values()) {
    for (const item of round.items.values()) {
      if (item.type === 'round') continue; // we don't draw lines for round headers

      const staticMeasurements = calcStaticMeasurements(item, firstRounds, dimensions);

      const currentMatchParticipantsShortIds = [
        item.matchRelation.currentMatch.home?.shortId,
        item.matchRelation.currentMatch.away?.shortId,
      ]
        .filter((id) => !!id)
        .join(' ');

      const pathOptions: PathOptions = { ...dimensions.path, className: currentMatchParticipantsShortIds };

      const currentMatchPosition = getMatchPosition(round, item.matchRelation.currentMatch.id, staticMeasurements);

      debugMap[item.matchRelation.currentMatch.id] = {
        position: currentMatchPosition,
        staticMeasurements,
      };

      if (item.roundRelation.currentRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET) {
        continue;
      }

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

  return {
    svg: svgParts.join(''),
    debugMap,
  };
};
