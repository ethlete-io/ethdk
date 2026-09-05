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
