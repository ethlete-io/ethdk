import { BracketRoundId } from '../core';
import { BracketSwissColors, BracketSwissGroupColorType, getSwissGroupColorType } from '../linked/swiss';
import { curvePath } from './curve';
import { FinalizedBracketElement, FinalizedMatchBracketElement } from './grid/core/bracket-finalizer';
import { ComputedBracketGrid } from './grid/types';
import { BracketPosition } from './math';
import { PathOptions } from './path';
import { BracketDrawing, BracketEdge, BracketGradient, BracketRect } from './shapes';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type DrawSwissManDimensions<TRoundData, TMatchData> = {
  bracketGrid: ComputedBracketGrid<TRoundData, TMatchData>;
  path: Omit<PathOptions, 'className' | 'stroke' | 'id'>;

  // The swiss connection lines always bend twice with the same radius, so there is no
  // dedicated ending curve amount (it would make no sense here).
  curve: {
    lineStartingCurveAmount: number;
  };
  groupBorder: {
    padding: number;
    radius: number;
    width: number;
  };
  colors?: BracketSwissColors;

  /** Used to create document wide unique ids for the connection line gradients */
  idPrefix: string;
};

type SwissGroupGeometry = {
  id: string;
  wins: number;
  losses: number;
  colorType: BracketSwissGroupColorType;
  position: BracketPosition;
  winnerShortIds: string[];
  loserShortIds: string[];
};

type SwissRoundGeometry = {
  groups: Map<string, SwissGroupGeometry>;
};

// Every finalized column of a swiss grid is one group section. The connection lines run
// from group to group instead of match to match: the winners of group (w-l) move to group
// (w+1-l) inside the next round, the losers move to group (w-l+1).
const collectSwissRoundGeometries = <TRoundData, TMatchData>(
  bracketGrid: ComputedBracketGrid<TRoundData, TMatchData>,
): SwissRoundGeometry[] => {
  const rounds = new Map<BracketRoundId, SwissRoundGeometry>();

  for (const column of bracketGrid.columns) {
    const matchElements = column.elements.filter(
      (
        element: FinalizedBracketElement<TRoundData, TMatchData>,
      ): element is FinalizedMatchBracketElement<TRoundData, TMatchData> => element.type === 'match',
    );
    const group = matchElements[0]?.roundSwissGroup;
    const round = matchElements[0]?.round;

    if (!group || !round) continue;

    const [wins, losses] = group.id.split('-').map(Number);

    if (wins === undefined || losses === undefined || isNaN(wins) || isNaN(losses)) {
      throw new BracketRuntimeError(
        BRACKET_ERROR_CODES.SWISS_GROUPING_FAILED,
        `Unable to parse wins and losses from Swiss group id: ${group.id}`,
      );
    }

    const matchesTop = Math.min(...matchElements.map((element) => element.dimensions.top));
    const matchesBottom = Math.max(
      ...matchElements.map((element) => element.dimensions.top + element.dimensions.height),
    );

    const winnerShortIds: string[] = [];
    const loserShortIds: string[] = [];

    for (const element of matchElements) {
      if (!element.match.winner) continue;

      const winner = element.match.winner;
      const loser = element.match.home?.id === winner.id ? element.match.away : element.match.home;

      winnerShortIds.push(winner.shortId);
      if (loser) loserShortIds.push(loser.shortId);
    }

    // The lines attach to the group border, which wraps the matches plus the group
    // padding and therefore matches the section bounds horizontally.
    const position: BracketPosition = {
      block: {
        start: matchesTop,
        end: matchesBottom,
        center: (matchesTop + matchesBottom) / 2,
      },
      inline: {
        start: column.dimensions.left,
        end: column.dimensions.left + column.dimensions.width,
        center: column.dimensions.left + column.dimensions.width / 2,
      },
    };

    let roundGeometry = rounds.get(round.id);

    if (!roundGeometry) {
      roundGeometry = { groups: new Map() };
      rounds.set(round.id, roundGeometry);
    }

    roundGeometry.groups.set(group.id, {
      id: group.id,
      wins,
      losses,
      colorType: getSwissGroupColorType(wins, losses),
      position,
      winnerShortIds,
      loserShortIds,
    });
  }

  // The finalized columns are ordered left to right, so first appearance equals round order
  return Array.from(rounds.values());
};

const groupBorderRect = (
  group: SwissGroupGeometry,
  border: DrawSwissManDimensions<unknown, unknown>['groupBorder'],
  color: string | undefined,
  id: string,
  // eslint-disable-next-line max-params -- SVG geometry helper; (group, border, color, id) are distinct positional inputs
): BracketRect => {
  // The group box wraps the matches plus the group padding plus the border itself. The
  // rect is inset by half the stroke width so the stroke renders fully inside the group
  // bounds instead of getting cut off at the edges of the bracket container.
  const boxPadding = border.padding + border.width;
  const strokeInset = border.width / 2;

  return {
    id,
    x: group.position.inline.start + strokeInset,
    y: group.position.block.start - boxPadding + strokeInset,
    width: group.position.inline.end - group.position.inline.start - border.width,
    height: group.position.block.end - group.position.block.start + boxPadding * 2 - border.width,
    radius: border.radius,
    stroke: color ?? 'currentColor',
    strokeWidth: border.width,
    cssClass: `et-bracket-swiss-group-border et-bracket-swiss-group-border--${group.id} et-bracket-swiss-group-border--${group.colorType}`,
  };
};

type SwissLineGradient = {
  id: string;
  fromX: number;
  toX: number;
  from: string;
  neutral: string;
  to: string;
};

// A horizontal gradient for the connection lines: they leave the source group in its
// color, fade to the neutral color towards their vertical jog in the middle and fade into
// the target group color on the second half. The connection lines always run from left to
// right, so user space coordinates can be used (they also work for straight lines, where
// the bounding box has no height).
const lineGradient = (config: SwissLineGradient): BracketGradient => ({
  id: config.id,
  fromX: config.fromX,
  toX: config.toX,
  stops: [
    { offset: '0%', color: config.from },
    { offset: '50%', color: config.neutral },
    { offset: '100%', color: config.to },
  ],
});

export const drawSwissMan = <TRoundData, TMatchData>(
  dimensions: DrawSwissManDimensions<TRoundData, TMatchData>,
): BracketDrawing => {
  const edges: BracketEdge[] = [];
  const rects: BracketRect[] = [];
  const gradients: BracketGradient[] = [];

  const roundGeometries = collectSwissRoundGeometries(dimensions.bracketGrid);
  const colors = dimensions.colors;

  for (const [roundIndex, roundGeometry] of roundGeometries.entries()) {
    for (const group of roundGeometry.groups.values()) {
      rects.push(
        groupBorderRect(group, dimensions.groupBorder, colors?.[group.colorType], `r${roundIndex}|${group.id}`),
      );
    }
  }

  const curveOptions = {
    lineStartingCurveAmount: dimensions.curve.lineStartingCurveAmount,
    lineEndingCurveAmount: dimensions.curve.lineStartingCurveAmount,
  };

  for (const [roundIndex, roundGeometry] of roundGeometries.entries()) {
    const nextRoundGeometry = roundGeometries[roundIndex + 1];

    if (!nextRoundGeometry) break;

    for (const group of roundGeometry.groups.values()) {
      const targets = [
        { geometry: nextRoundGeometry.groups.get(`${group.wins + 1}-${group.losses}`), shortIds: group.winnerShortIds },
        { geometry: nextRoundGeometry.groups.get(`${group.wins}-${group.losses + 1}`), shortIds: group.loserShortIds },
      ];

      for (const { geometry: target, shortIds } of targets) {
        if (!target) continue;

        const edgeId = `r${roundIndex}|${group.id}|${target.id}`;
        // Only URI characters: this ends up inside a `url(#…)` the `stroke` attribute has to resolve.
        const gradientId = `${dimensions.idPrefix}-swiss-line-r${roundIndex}-${group.id}-to-${target.id}`;
        const neutralColor = colors?.neutral;

        let stroke = neutralColor;

        if (neutralColor) {
          const from = colors?.[group.colorType] ?? neutralColor;
          const to = colors?.[target.colorType] ?? neutralColor;

          if (from !== neutralColor || to !== neutralColor) {
            gradients.push(
              lineGradient({
                id: gradientId,
                fromX: group.position.inline.end,
                toX: target.position.inline.start,
                from,
                neutral: neutralColor,
                to,
              }),
            );

            stroke = `url(#${gradientId})`;
          }
        }

        const pathOptions: PathOptions = {
          ...dimensions.path,
          id: edgeId,
          className: shortIds.join(' '),
          stroke,
        };
        const blockDelta = target.position.block.center - group.position.block.center;

        // Always a curve, even between two groups on the same row, where the bends collapse to nothing
        // and it draws as a straight run - one shape per connector is what lets it animate.
        edges.push(
          curvePath(group.position, target.position, blockDelta < 0 ? 'up' : 'down', {
            ...curveOptions,
            path: pathOptions,
          }),
        );
      }
    }
  }

  return { edges, rects, gradients };
};
