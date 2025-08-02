import { BRACKET_ROUND_MIRROR_TYPE, BracketMatchId, BracketRoundId } from '../core';
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

export type DrawManDebugData = {
  position: BracketPosition;
  staticMeasurements: StaticMeasurements;
};

export const drawMan = <TRoundData, TMatchData>(
  rounds: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>>,
  firstRounds: FirstRounds<TRoundData, TMatchData>,
  dimensions: DrawManDimensions,
) => {
  const svgParts: string[] = [];
  const debugMap: Record<BracketMatchId, DrawManDebugData> = {};

  for (const round of rounds.values()) {
    for (const gridItem of round.items.values()) {
      if (gridItem.type === 'round') continue; // we don't draw lines for round headers

      const currentStaticMeasurements = calcStaticMeasurements(gridItem, firstRounds, dimensions);

      const currentMatchParticipantsShortIds = [
        gridItem.matchRelation.currentMatch.home?.shortId,
        gridItem.matchRelation.currentMatch.away?.shortId,
      ]
        .filter((id) => !!id)
        .join(' ');

      const pathOptions: PathOptions = { ...dimensions.path, className: currentMatchParticipantsShortIds };

      const currentMatchPosition = getMatchPosition(
        round,
        gridItem.matchRelation.currentMatch.id,
        currentStaticMeasurements,
      );

      debugMap[gridItem.matchRelation.currentMatch.id] = {
        position: currentMatchPosition,
        staticMeasurements: currentStaticMeasurements,
      };

      // We only draw the left side of the match relation
      switch (gridItem.matchRelation.type) {
        case 'nothing-to-one': {
          continue;
        }
        case 'one-to-nothing':
        case 'one-to-one': {
          const previousStaticMeasurements = debugMap[gridItem.matchRelation.previousMatch.id]?.staticMeasurements;

          if (!previousStaticMeasurements) {
            throw new Error(
              `Static measurements for previous match with id ${gridItem.matchRelation.previousMatch.id} not found`,
            );
          }

          const previousMatchPosition = getMatchPosition(
            rounds.get(gridItem.matchRelation.previousRound.id),
            gridItem.matchRelation.previousMatch.id,
            previousStaticMeasurements,
          );

          // draw a straight line
          svgParts.push(linePath(previousMatchPosition, currentMatchPosition, { path: pathOptions }));

          break;
        }

        case 'two-to-nothing':
        case 'two-to-one': {
          const previousUpperStaticMeasurements =
            debugMap[gridItem.matchRelation.previousUpperMatch.id]?.staticMeasurements;
          const previousLowerStaticMeasurements =
            debugMap[gridItem.matchRelation.previousLowerMatch.id]?.staticMeasurements;

          if (!previousUpperStaticMeasurements || !previousLowerStaticMeasurements) {
            throw new Error(
              `Static measurements for previous upper match with id ${gridItem.matchRelation.previousUpperMatch.id} or previous lower match with id ${gridItem.matchRelation.previousLowerMatch.id} not found`,
            );
          }

          const previousUpper = getMatchPosition(
            rounds.get(gridItem.matchRelation.previousUpperRound.id),
            gridItem.matchRelation.previousUpperMatch.id,
            previousUpperStaticMeasurements,
          );

          const previousLower = getMatchPosition(
            rounds.get(gridItem.matchRelation.previousLowerRound.id),
            gridItem.matchRelation.previousLowerMatch.id,
            previousLowerStaticMeasurements,
          );

          if (round.roundRelation.currentRound.type === 'final') {
            console.log({
              previousUpper,
              previousLower,
              currentMatchPosition,
              currentStaticMeasurements,
              previousUpperStaticMeasurements,
              previousLowerStaticMeasurements,
            });
          }

          const invertCurve = gridItem.roundRelation.currentRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT;

          const curveOptions: CurveOptions = {
            ...dimensions.curve,
            inverted: invertCurve,
            path: { ...dimensions.path, className: '' },
          };

          // draw two lines that merge into one in the middle
          svgParts.push(
            curvePath(previousUpper, currentMatchPosition, 'down', {
              ...curveOptions,
              path: {
                ...curveOptions.path,
                className: gridItem.matchRelation.previousUpperMatch.winner?.shortId || '',
              },
            }),
          );
          svgParts.push(
            curvePath(previousLower, currentMatchPosition, 'up', {
              ...curveOptions,
              path: {
                ...curveOptions.path,
                className: gridItem.matchRelation.previousLowerMatch.winner?.shortId || '',
              },
            }),
          );

          if (
            gridItem.matchRelation.currentRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT &&
            gridItem.matchRelation.type === 'two-to-one' &&
            gridItem.matchRelation.nextRound.mirrorRoundType === null
          ) {
            // draw a straight line for the special case of connecting the final match to the mirrored semi final match

            const next = getMatchPosition(
              rounds.get(gridItem.matchRelation.nextRound.id),
              gridItem.matchRelation.nextMatch.id,
              currentStaticMeasurements,
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
