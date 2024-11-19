import { BracketRoundId, BracketRoundRelations } from './bracket-new';
import { BracketGridDefinitions } from './grid-definitions';
import { BracketGridRoundItem } from './grid-placements';

export type DrawManDimensions = {
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  columnGap: number;
  rowGap: number;
  gridDefinitions: BracketGridDefinitions;
};

const LINE_WIDTH = 1;

const path = (d: string) => `<path d="${d}" stroke="red" fill="none" stroke-width="${LINE_WIDTH}" />`;

export const drawMan = <TRoundData, TMatchData>(
  items: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  dimensions: DrawManDimensions,
) => {
  const { columnWidth, matchHeight, rowGap, columnGap, roundHeaderHeight, gridDefinitions } = dimensions;
  const roundHeaderRowGap = roundHeaderHeight ? rowGap : 0;
  const baseOffsetY = roundHeaderHeight + roundHeaderRowGap;

  const columnGapCenter = columnGap / 2;
  const totalHeight =
    (gridDefinitions.rowCount - 1) * matchHeight + (gridDefinitions.rowCount - 1) * rowGap + roundHeaderHeight; // TODO: This is not correct in double elimination
  const svgParts: string[] = [];

  // a nothing to one draws nothing
  // a one to nothing draws nothing
  // a one to one draws a line
  // a one to two draws a line that splits into in the middle
  // a two to one draws two lines that merge into one in the middle

  // WE ONLY EVER DRAW THE LEFT SIDE (on-to, nothing-to, two-to)

  for (const round of items.values()) {
    const rows = round.roundRelation.currentRound.matchCount;
    const rowGaps = rows - 1;
    const rowHeight = (totalHeight - baseOffsetY) / rows - rowGaps * rowGap;
    const rowWhitespace = (rowHeight - matchHeight) / 2;
    const matchHeightOffset = rowWhitespace + matchHeight / 2; // the vertical middle of a match in this row

    for (const item of round.items.values()) {
      if (item.type === 'round') continue; // we don't draw lines for round headers

      switch (item.matchRelation.type) {
        case 'nothing-to-one': {
          continue;
        }
        case 'one-to-nothing':
        case 'one-to-one': {
          // draw a straight line
          const previousRound = items.get(item.matchRelation.previousRound.id);
          if (!previousRound) throw new Error('Previous round or match is missing');
          const previousMatch = previousRound.items.get(item.matchRelation.previousMatch.id);
          if (!previousMatch || previousMatch.type !== 'match') throw new Error('Previous round or match is missing');

          const previousRoundRows = previousRound.roundRelation.currentRound.matchCount;
          const previousRoundRowGaps = previousRoundRows - 1;

          const previousRoundRowHeight =
            (totalHeight - baseOffsetY) / previousRoundRows - previousRoundRowGaps * rowGap;

          const previousRoundRowWhitespace = (previousRoundRowHeight - matchHeight) / 2;
          const previousRoundMatchHeightOffset = previousRoundRowWhitespace + matchHeight / 2;

          const fromX = previousRound.columnStart * columnWidth + (round.columnStart - 2) * columnGap;
          const toX = (round.columnStart - 1) * columnWidth + (round.columnStart - 1) * columnGap;

          const fromY =
            previousMatch.matchRelation.currentMatch.indexInRound * previousRoundRowWhitespace +
            previousMatch.matchRelation.currentMatch.indexInRound * rowGap +
            baseOffsetY +
            previousRoundMatchHeightOffset;
          const toY =
            item.matchRelation.currentMatch.indexInRound * rowWhitespace +
            item.matchRelation.currentMatch.indexInRound * rowGap +
            baseOffsetY +
            matchHeightOffset;

          svgParts.push(path(`M ${fromX} ${fromY} L ${toX} ${toY}`));

          break;
        }
        case 'two-to-nothing':
        case 'two-to-one': {
          // draw two lines that merge into one in the middle

          break;
        }
      }
    }
  }

  return svgParts.join(' /n');
};
