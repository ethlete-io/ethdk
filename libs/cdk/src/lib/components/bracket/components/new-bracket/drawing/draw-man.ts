import { BRACKET_ROUND_MIRROR_TYPE, COMMON_BRACKET_ROUND_TYPE } from '../core';
import { CurveOptions, curvePath } from './curve';
import { ComputedBracketGrid, Dimensions, isBracketContinueMatch } from './grid';
import { linePath } from './line';
import { BracketPosition } from './math';
import { path, PathOptions } from './path';

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

  /** Path options for the lines connecting the continuing matches to the continue element */
  continuePath?: Omit<PathOptions, 'className'>;
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

  const continueElement = dimensions.bracketGrid.columns
    .flatMap((col) => col.elements)
    .find((el) => el.type === 'continue');
  const continuePos = continueElement ? makePos(continueElement.dimensions) : null;
  const continueSources: { pos: BracketPosition; className: string }[] = [];

  for (const col of dimensions.bracketGrid.columns) {
    for (const el of col.elements) {
      if (el.type !== 'match') continue;

      const currentMatchParticipantsShortIds = [el.match.home?.shortId, el.match.away?.shortId]
        .filter((id) => !!id)
        .join(' ');

      const pathOptions: PathOptions = { ...dimensions.path, className: currentMatchParticipantsShortIds };

      const currentPos = makePos(el.dimensions);

      // No lines for the third place match
      if (el.round.type === COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE) continue;

      if (continuePos && isBracketContinueMatch(el.match)) {
        continueSources.push({ pos: currentPos, className: el.match.winner?.shortId || '' });
      }

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

  if (continuePos && continueSources.length) {
    const continuePathOptions = dimensions.continuePath ?? dimensions.path;
    const sharedPathOptions: PathOptions = { ...continuePathOptions, className: '' };
    const curveAmount = dimensions.curve.lineStartingCurveAmount;
    const trunkInline = continuePos.inline.start - dimensions.columnGap / 2;
    const continueBlockCenter = continuePos.block.center;
    const sourceBlocks = continueSources.map((source) => source.pos.block.center);
    const firstSourceBlock = Math.min(...sourceBlocks);
    const lastSourceBlock = Math.max(...sourceBlocks);
    const trunkBlocks: number[] = [continueBlockCenter];

    for (const source of continueSources) {
      const sourceBlockCenter = source.pos.block.center;
      const blockDistance = continueBlockCenter - sourceBlockCenter;
      const sourcePathOptions: PathOptions = { ...continuePathOptions, className: source.className };

      const isTrunkCorner =
        (sourceBlockCenter === firstSourceBlock && blockDistance > 0.5) ||
        (sourceBlockCenter === lastSourceBlock && blockDistance < -0.5);

      if (!isTrunkCorner) {
        svgParts.push(path(`M ${source.pos.inline.end} ${sourceBlockCenter} H ${trunkInline}`, sourcePathOptions));
        trunkBlocks.push(sourceBlockCenter);
      } else {
        const curve = Math.min(curveAmount, Math.abs(blockDistance));
        const curveEndBlock = sourceBlockCenter + curve * Math.sign(blockDistance);

        svgParts.push(
          path(
            `M ${source.pos.inline.end} ${sourceBlockCenter}
             H ${trunkInline - curve}
             Q ${trunkInline} ${sourceBlockCenter}, ${trunkInline} ${curveEndBlock}`,
            sourcePathOptions,
          ),
        );

        trunkBlocks.push(curveEndBlock);
      }
    }

    const trunkBlockStart = Math.min(...trunkBlocks);
    const trunkBlockEnd = Math.max(...trunkBlocks);

    if (trunkBlockEnd - trunkBlockStart > 0.5) {
      svgParts.push(path(`M ${trunkInline} ${trunkBlockStart} V ${trunkBlockEnd}`, sharedPathOptions));
    }

    svgParts.push(path(`M ${trunkInline} ${continueBlockCenter} H ${continuePos.inline.start}`, sharedPathOptions));
  }

  return svgParts.join('');
};
