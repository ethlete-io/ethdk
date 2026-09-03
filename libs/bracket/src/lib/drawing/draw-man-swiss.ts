import { BracketRoundId } from '../core';
import { BracketSwissColors, BracketSwissGroupColorType, getSwissGroupColorType } from '../linked/swiss';
import { curvePath } from './curve';
import { FinalizedBracketElement, FinalizedMatchBracketElement } from './grid/core/bracket-finalizer';
import { ComputedBracketGrid } from './grid/types';
import { linePath } from './line';
import { BracketPosition } from './math';
import { PathOptions } from './path';
import { escapeSvgAttributeValue } from './svg';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type DrawSwissManDimensions<TRoundData, TMatchData> = {
  bracketGrid: ComputedBracketGrid<TRoundData, TMatchData>;
  path: Omit<PathOptions, 'className' | 'stroke'>;

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
  // eslint-disable-next-line max-params -- SVG geometry helper; (group, border, color) are distinct positional inputs
) => {
  // The group box wraps the matches plus the group padding plus the border itself. The
  // rect is inset by half the stroke width so the stroke renders fully inside the group
  // bounds instead of getting cut off at the edges of the bracket container.
  const boxPadding = border.padding + border.width;
  const strokeInset = border.width / 2;

  const x = group.position.inline.start + strokeInset;
  const y = group.position.block.start - boxPadding + strokeInset;
  const width = group.position.inline.end - group.position.inline.start - border.width;
  const height = group.position.block.end - group.position.block.start + boxPadding * 2 - border.width;

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${border.radius}" stroke="${escapeSvgAttributeValue(color ?? 'currentColor')}" fill="none" stroke-width="${border.width}" class="et-bracket-swiss-group-border et-bracket-swiss-group-border--${group.id} et-bracket-swiss-group-border--${group.colorType}" />`;
};

// A horizontal gradient for the connection lines: they leave the source group in its
// color, fade to the neutral color towards their vertical jog in the middle and fade into
// the target group color on the second half. The connection lines always run from left to
// right, so user space coordinates can be used (they also work for straight lines, where
// the bounding box has no height).
// eslint-disable-next-line max-params -- SVG gradient stops are inherently positional (id, fromX, toX, from, neutral, to)
const lineGradientDef = (id: string, fromX: number, toX: number, from: string, neutral: string, to: string) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fromX}" y1="0" x2="${toX}" y2="0"><stop offset="0%" stop-color="${escapeSvgAttributeValue(from)}" /><stop offset="50%" stop-color="${escapeSvgAttributeValue(neutral)}" /><stop offset="100%" stop-color="${escapeSvgAttributeValue(to)}" /></linearGradient>`;

export const drawSwissMan = <TRoundData, TMatchData>(dimensions: DrawSwissManDimensions<TRoundData, TMatchData>) => {
  const svgParts: string[] = [];
  const gradientDefs: string[] = [];

  const roundGeometries = collectSwissRoundGeometries(dimensions.bracketGrid);
  const colors = dimensions.colors;

  for (const roundGeometry of roundGeometries) {
    for (const group of roundGeometry.groups.values()) {
      svgParts.push(groupBorderRect(group, dimensions.groupBorder, colors?.[group.colorType]));
    }
  }

  const curveOptions = {
    lineStartingCurveAmount: dimensions.curve.lineStartingCurveAmount,
    lineEndingCurveAmount: dimensions.curve.lineStartingCurveAmount,
  };

  let edgeIndex = 0;

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

        const neutralColor = colors?.neutral;
        const fromColor = colors?.[group.colorType] ?? neutralColor;
        const toColor = colors?.[target.colorType] ?? neutralColor;

        let stroke = neutralColor;

        if (neutralColor && (fromColor !== neutralColor || toColor !== neutralColor)) {
          const gradientId = `${dimensions.idPrefix}-swiss-line-${edgeIndex}`;
          const fromX = group.position.inline.end;
          const toX = target.position.inline.start;

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          gradientDefs.push(lineGradientDef(gradientId, fromX, toX, fromColor!, neutralColor, toColor!));

          stroke = `url(#${gradientId})`;
        }

        const pathOptions: PathOptions = { ...dimensions.path, className: shortIds.join(' '), stroke };
        const blockDelta = target.position.block.center - group.position.block.center;

        if (Math.abs(blockDelta) < 0.5) {
          svgParts.push(linePath(group.position, target.position, { path: pathOptions }));
        } else {
          svgParts.push(
            curvePath(group.position, target.position, blockDelta > 0 ? 'down' : 'up', {
              ...curveOptions,
              path: pathOptions,
            }),
          );
        }

        edgeIndex++;
      }
    }
  }

  const defs = gradientDefs.length ? `<defs>${gradientDefs.join('')}</defs>` : '';

  return defs + svgParts.join('');
};
