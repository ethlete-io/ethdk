import { BracketRoundId } from '../core';
import { BracketSwissGroupColorType, getSwissGroupColorType } from '../linked';
import { BracketSwissColors } from '../new-bracket.config';
import { curvePath } from './curve';
import { ComputedBracketGrid, FinalizedBracketElement, FinalizedMatchBracketElement } from './grid';
import { linePath } from './line';
import { BracketPosition } from './math';
import { PathOptions } from './path';

export type DrawSwissManDimensions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bracketGrid: ComputedBracketGrid<any, any>;
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
const collectSwissRoundGeometries = (bracketGrid: ComputedBracketGrid<any, any>): SwissRoundGeometry[] => {
  const rounds = new Map<BracketRoundId, SwissRoundGeometry>();

  for (const column of bracketGrid.columns) {
    const matchElements = column.elements.filter(
      (element: FinalizedBracketElement<any, any>): element is FinalizedMatchBracketElement<any, any> =>
        element.type === 'match',
    );
    const group = matchElements[0]?.roundSwissGroup;
    const round = matchElements[0]?.round;

    if (!group || !round) continue;

    const [wins, losses] = group.id.split('-').map(Number);

    if (wins === undefined || losses === undefined || isNaN(wins) || isNaN(losses)) {
      throw new Error(`Unable to parse wins and losses from Swiss group id: ${group.id}`);
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
  border: DrawSwissManDimensions['groupBorder'],
  color: string | undefined,
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

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${border.radius}" stroke="${color ?? 'currentColor'}" fill="none" stroke-width="${border.width}" class="et-bracket-new-swiss-group-border et-bracket-new-swiss-group-border--${group.id} et-bracket-new-swiss-group-border--${group.colorType}" />`;
};

// A horizontal gradient from the source group color to the target group color. The
// connection lines always run from left to right, so user space coordinates can be used
// (they also work for straight lines, where the bounding box has no height).
const lineGradientDef = (id: string, fromX: number, toX: number, fromColor: string, toColor: string) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fromX}" y1="0" x2="${toX}" y2="0"><stop offset="0%" stop-color="${fromColor}" /><stop offset="100%" stop-color="${toColor}" /></linearGradient>`;

export const drawSwissMan = (dimensions: DrawSwissManDimensions) => {
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

        const fromColor = colors?.[group.colorType];
        const toColor = colors?.[target.colorType];

        let stroke: string | undefined;

        if (fromColor && toColor && fromColor !== toColor) {
          const gradientId = `${dimensions.idPrefix}-swiss-line-${edgeIndex}`;

          gradientDefs.push(
            lineGradientDef(gradientId, group.position.inline.end, target.position.inline.start, fromColor, toColor),
          );

          stroke = `url(#${gradientId})`;
        } else {
          stroke = fromColor ?? toColor;
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
