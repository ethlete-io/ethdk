import { BRACKET_DATA_LAYOUT } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { BracketComponents } from './core';
import { createSingleEliminationGrid } from './single-elimination';
import { CreateBracketGridConfig } from './types';

const COLUMN_WIDTH = 200;
const COLUMN_GAP = 50;

const CONFIG: CreateBracketGridConfig = {
  includeRoundHeaders: false,
  columnWidth: COLUMN_WIDTH,
  matchHeight: 80,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: COLUMN_GAP,
  rowRoundGap: 0,
  rowGap: 10,
  rowSpanRoundId: null,
  finalMatchHeight: 80,
  finalColumnWidth: COLUMN_WIDTH,
  swissGroupPadding: 0,
  swissGroupBorderWidth: 0,
  layout: BRACKET_DATA_LAYOUT.MIRRORED,
};

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
} as unknown as BracketComponents<null, null>;

const singleElimination = (matchCounts: number[]): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: matchCounts.map((_, roundIndex) => ({
    id: `r${roundIndex}`,
    name: `Round ${roundIndex}`,
    type: roundIndex === matchCounts.length - 1 ? ('final' as const) : ('single-elimination-bracket' as const),
    data: null,
  })),
  matches: matchCounts.flatMap((count, roundIndex) =>
    Array.from({ length: count }, (_, matchIndex) => ({
      id: `r${roundIndex}m${matchIndex}`,
      roundId: `r${roundIndex}`,
      home: null,
      away: null,
      winner: null,
      status: 'pending' as const,
      data: null,
    })),
  ),
});

/** Each match by the column it was drawn in, so a card on the wrong side of the fold is visible. */
const matchColumns = (matchCounts: number[]) => {
  const grid = createSingleEliminationGrid(
    createBracket(singleElimination(matchCounts), { layout: BRACKET_DATA_LAYOUT.MIRRORED }),
    CONFIG,
    COMPONENTS,
  );

  return Object.fromEntries(
    [...grid.matchElementMap.entries()].map(([id, element]) => [
      id,
      element.dimensions.left / (COLUMN_WIDTH + COLUMN_GAP),
    ]),
  );
};

describe('createSingleEliminationGrid, mirrored', () => {
  it('draws a field it cannot halve all the way down in one column per round', () => {
    expect(matchColumns([6, 3, 2, 1])).toEqual({
      r0m0: 0,
      r0m1: 0,
      r0m2: 0,
      r1m0: 1,
      r1m1: 1,
      r1m2: 1,
      r2m0: 2,
      r2m1: 2,
      r3m0: 3,
      r0m3: 4,
      r0m4: 4,
      r0m5: 4,
    });
  });

  it('folds the semi finals around a final that has no match yet', () => {
    expect(matchColumns([2, 0])).toEqual({ r0m0: 0, r0m1: 2 });
  });
});

/** Every part height of every element, keyed by the element's area. */
const partHeights = (matchCounts: number[]) => {
  const grid = createSingleEliminationGrid(
    createBracket(singleElimination(matchCounts), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
    { ...CONFIG, layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT },
    COMPONENTS,
  );

  const rows: { area: string; heights: number[]; container: number }[] = [];

  for (const masterColumn of grid.raw.grid.masterColumns) {
    for (const section of masterColumn.sections) {
      for (const subColumn of section.subColumns) {
        for (const element of subColumn.elements) {
          rows.push({
            area: element.area,
            heights: element.parts.map((part) => part.dimensions.height),
            container: element.containerDimensions.height,
          });
        }
      }
    }
  }

  return rows;
};

describe('createSingleEliminationGrid, element parts', () => {
  it('fills a round that does not divide the first round evenly with positive parts only', () => {
    for (const row of partHeights([3, 2, 1])) {
      expect(row.heights.filter((height) => height < 0)).toEqual([]);
      expect(row.heights.reduce((total, height) => total + height, 0)).toBe(row.container);
    }
  });

  it('leaves a round that divides the first round evenly subdivided per fed match', () => {
    const rows = partHeights([4, 2, 1]);

    expect(rows.find((row) => row.area === 'm1-0')?.heights).toEqual([80, 10, 80]);
    expect(rows.find((row) => row.area === 'm2-0')?.heights).toEqual([80, 10, 80, 10, 80, 10, 80]);
  });
});
