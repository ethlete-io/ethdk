import { BRACKET_ROUND_MIRROR_TYPE, COMMON_BRACKET_ROUND_TYPE } from '../core';
import { CurveOptions, curvePath } from './curve';
import { ComputedBracketGrid, Dimensions } from './grid';
import { linePath } from './line';
import { BracketPosition } from './math';
import { PathOptions } from './path';

export type DrawManDimensions = {
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  columnGap: number;
  upperLowerGap: number;
  rowGap: number;
  bracketGrid: ComputedBracketGrid<any, any>;
  path: Omit<PathOptions, 'className'>;
  curve: Omit<CurveOptions, 'path' | 'inverted'>;
};

const makePos = (dimensions: Dimensions): BracketPosition => ({
  block: {
    start: dimensions.top,
    end: dimensions.top + dimensions.height,
    center: dimensions.top + dimensions.height / 2,
  },
  inline: {
    start: dimensions.left,
    end: dimensions.left + dimensions.width,
    center: dimensions.left + dimensions.width / 2,
  },
});

export const drawMan = <TRoundData, TMatchData>(dimensions: DrawManDimensions) => {
  const svgParts: string[] = [];

  for (const col of dimensions.bracketGrid.columns) {
    for (const el of col.elements) {
      if (el.type === 'header') continue;

      const currentMatchParticipantsShortIds = [el.match.home?.shortId, el.match.away?.shortId]
        .filter((id) => !!id)
        .join(' ');

      const pathOptions: PathOptions = { ...dimensions.path, className: currentMatchParticipantsShortIds };

      const currentPos = makePos(el.dimensions);

      // No lines for the third place match
      if (el.round.type === COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE) continue;

      switch (el.match.relation.type) {
        case 'nothing-to-one': {
          continue;
        }
        case 'one-to-nothing':
        case 'one-to-one': {
          const prev = dimensions.bracketGrid.matchElementMap.getOrThrow(el.match.relation.previousMatch.id);
          const prevPos = makePos(prev.dimensions);

          // draw a straight line
          svgParts.push(linePath(prevPos, currentPos, { path: pathOptions }));

          break;
        }

        case 'two-to-nothing':
        case 'two-to-one': {
          const prevUpper = dimensions.bracketGrid.matchElementMap.getOrThrow(el.match.relation.previousUpperMatch.id);
          const prevLower = dimensions.bracketGrid.matchElementMap.getOrThrow(el.match.relation.previousLowerMatch.id);

          const prevUpperPos = makePos(prevUpper.dimensions);
          const prevLowerPos = makePos(prevLower.dimensions);

          const isLowerUpperMerger =
            el.match.relation.previousLowerRound.id !== el.match.relation.previousUpperRound.id;

          const invertCurve = el.round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT;

          const curveOptions: CurveOptions = {
            ...dimensions.curve,
            inverted: invertCurve,
            path: { ...dimensions.path, className: '' },
          };

          if (isLowerUpperMerger) {
            svgParts.push(linePath(prevUpperPos, currentPos, { path: pathOptions }));
          } else {
            // draw two lines that merge into one in the middle
            svgParts.push(
              curvePath(prevUpperPos, currentPos, 'down', {
                ...curveOptions,
                path: {
                  ...curveOptions.path,
                  className: el.match.relation.previousUpperMatch.winner?.shortId || '',
                },
              }),
            );
          }

          svgParts.push(
            curvePath(prevLowerPos, currentPos, 'up', {
              ...curveOptions,
              path: {
                ...curveOptions.path,
                className: el.match.relation.previousLowerMatch.winner?.shortId || '',
              },
            }),
          );

          if (
            el.round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT &&
            el.match.relation.type === 'two-to-one' &&
            el.match.relation.nextRound.mirrorRoundType === null
          ) {
            // draw a straight line for the special case of connecting the final match to the mirrored semi final match

            const next = dimensions.bracketGrid.matchElementMap.getOrThrow(el.match.relation.nextMatch.id);
            const nextPos = makePos(next.dimensions);

            svgParts.push(linePath(nextPos, currentPos, { path: pathOptions }));
          }

          break;
        }
      }
    }
  }

  return svgParts.join('');
};
