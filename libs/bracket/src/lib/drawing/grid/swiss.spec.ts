import { BRACKET_DATA_LAYOUT, MatchParticipantSide, SWISS_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { BracketComponents } from './core';
import { createSwissGrid } from './swiss';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';

const COLUMN_WIDTH = 200;
const COLUMN_GAP = 50;
const MATCH_HEIGHT = 80;
const ROW_GAP = 10;
const ROW_ROUND_GAP = 30;
const GROUP_PADDING = 8;
const GROUP_BORDER_WIDTH = 2;

const CONFIG: CreateBracketGridConfig = {
  includeRoundHeaders: false,
  columnWidth: COLUMN_WIDTH,
  matchHeight: MATCH_HEIGHT,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: COLUMN_GAP,
  rowRoundGap: ROW_ROUND_GAP,
  rowGap: ROW_GAP,
  rowSpanRoundId: null,
  finalMatchHeight: MATCH_HEIGHT,
  finalColumnWidth: COLUMN_WIDTH,
  swissGroupPadding: GROUP_PADDING,
  swissGroupBorderWidth: GROUP_BORDER_WIDTH,
  layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
};

const HEADED: Partial<CreateBracketGridConfig> = {
  includeRoundHeaders: true,
  roundHeaderHeight: 40,
  roundHeaderGap: 10,
};

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
} as unknown as BracketComponents<null, null>;

type SwissMatchInput = [id: string, home: string | null, away: string | null, winner: MatchParticipantSide | null];

const swissSource = (rounds: SwissMatchInput[][]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: rounds.map((_, index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: rounds.flatMap((matches, index) =>
    matches.map(([id, home, away, winner]) => ({
      id,
      roundId: `r${index}`,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

const TWO_ROUNDS = swissSource([
  [
    ['r0-m0', 'a', 'b', 'home'],
    ['r0-m1', 'c', 'd', 'home'],
  ],
  [
    ['r1-m0', 'a', 'c', null],
    ['r1-m1', 'b', 'd', null],
  ],
]);

const THREE_ROUNDS = swissSource([
  [
    ['r0-m0', 'a', 'b', 'home'],
    ['r0-m1', 'c', 'd', 'home'],
  ],
  [
    ['r1-m0', 'a', 'c', 'home'],
    ['r1-m1', 'b', 'd', 'home'],
  ],
  [['r2-m0', 'c', 'b', null]],
]);

const swissGrid = (source: BracketDataSource<null, null>, config: Partial<CreateBracketGridConfig> = {}) =>
  createSwissGrid(
    createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
    { ...CONFIG, ...config },
    COMPONENTS,
  );

const matchBoxes = (grid: ComputedBracketGrid<null, null>) =>
  Object.fromEntries(
    [...grid.matchElementMap.entries()].map(([id, element]) => [
      id,
      { left: element.dimensions.left, top: element.dimensions.top, width: element.dimensions.width },
    ]),
  );

const headerRows = (grid: ComputedBracketGrid<null, null>) =>
  grid.columns
    .flatMap((column) => column.elements)
    .filter((element) => element.type === 'header')
    .map((element) => ({
      group: element.roundSwissGroup?.id,
      round: element.round.id,
      left: element.dimensions.left,
      top: element.dimensions.top,
      width: element.dimensions.width,
    }));

const rawElements = (grid: ComputedBracketGrid<null, null>) =>
  grid.raw.grid.masterColumns.flatMap((masterColumn, masterColumnIndex) =>
    masterColumn.sections.flatMap((section) =>
      section.subColumns.flatMap((subColumn) =>
        subColumn.elements.map((element) => ({
          masterColumnIndex,
          type: element.type,
          top: element.dimensions.top,
          height: element.dimensions.height,
        })),
      ),
    ),
  );

describe('createSwissGrid', () => {
  it('insets every match of a group by the group box and stacks it by the row gap', () => {
    expect(matchBoxes(swissGrid(TWO_ROUNDS))).toEqual({
      'r0-m0': { left: 10, top: 10, width: 180 },
      'r0-m1': { left: 10, top: 140, width: 180 },
      'r1-m0': { left: 260, top: 10, width: 180 },
      'r1-m1': { left: 260, top: 140, width: 180 },
    });
  });

  it('stretches the shorter column to the tallest one instead of leaving it short', () => {
    const grid = swissGrid(TWO_ROUNDS);

    expect(grid.raw.grid.dimensions).toEqual({ width: 450, height: 230, top: 0, left: 0 });
    expect(
      rawElements(grid).filter((element) => element.type === 'matchGap' && element.masterColumnIndex === 0),
    ).toEqual([{ masterColumnIndex: 0, type: 'matchGap', top: 90, height: 50 }]);
  });

  it('heads every group it draws and lowers its matches by the header row', () => {
    const grid = swissGrid(TWO_ROUNDS, HEADED);

    expect(headerRows(grid)).toEqual([
      { group: '0-0', round: 'r0', left: 0, top: 0, width: 200 },
      { group: '1-0', round: 'r1', left: 250, top: 0, width: 200 },
      { group: '0-1', round: 'r1', left: 250, top: 180, width: 200 },
    ]);

    expect(matchBoxes(grid)['r0-m0']).toEqual({ left: 10, top: 60, width: 180 });
    expect(matchBoxes(grid)['r1-m0']).toEqual({ left: 260, top: 60, width: 180 });
    expect(matchBoxes(grid)['r1-m1']).toEqual({ left: 260, top: 240, width: 180 });
  });

  it('tops a round that ends above the tallest column and fills the rest with one gap', () => {
    const grid = swissGrid(THREE_ROUNDS);

    expect(matchBoxes(grid)['r2-m0']).toEqual({ left: 510, top: 10, width: 180 });
    expect(rawElements(grid).filter((element) => element.type === 'colGap' && element.masterColumnIndex === 4)).toEqual(
      [{ masterColumnIndex: 4, type: 'colGap', top: 100, height: 130 }],
    );
    expect(grid.raw.grid.dimensions.height).toBe(230);
  });

  it('skips a group a round left empty rather than heading a group with no round', () => {
    expect(headerRows(swissGrid(THREE_ROUNDS, HEADED)).map((header) => header.group)).toEqual([
      '0-0',
      '1-0',
      '0-1',
      '1-1',
    ]);
  });

  it('draws a round whose matches carry no participants as one group', () => {
    const grid = swissGrid(
      swissSource([
        [
          ['r0-m0', null, null, null],
          ['r0-m1', null, null, null],
        ],
      ]),
    );

    expect(matchBoxes(grid)).toEqual({
      'r0-m0': { left: 10, top: 10, width: 180 },
      'r0-m1': { left: 10, top: 100, width: 180 },
    });
  });

  it('refuses a bracket that is not a swiss stage', () => {
    const source = { ...TWO_ROUNDS, mode: TOURNAMENT_MODE.SINGLE_ELIMINATION };

    expect(() =>
      createSwissGrid(createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }), CONFIG, COMPONENTS),
    ).toThrow('ET3408');
  });
});
