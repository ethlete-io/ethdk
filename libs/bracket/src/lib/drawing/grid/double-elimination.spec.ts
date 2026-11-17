import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { BracketComponents } from './core';
import { createDoubleEliminationGrid } from './double-elimination';
import { createStackedDoubleEliminationGrid } from './double-elimination-stacked';
import { BRACKET_SECTION_KEY, doubleEliminationRoundSection } from './sections';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';

const config = (layout: BracketDataLayout): CreateBracketGridConfig => ({
  includeRoundHeaders: false,
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: 50,
  rowRoundGap: 0,
  rowGap: 10,
  rowSpanRoundId: null,
  finalMatchHeight: 80,
  finalColumnWidth: 200,
  swissGroupPadding: 0,
  swissGroupBorderWidth: 0,
  layout,
});

const CONFIG = config(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
} as unknown as BracketComponents<null, null>;

const withoutLowerRounds: BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    { id: 'u1', name: 'Upper 1', type: 'upper-bracket', data: null },
    { id: 'f', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'm1', roundId: 'u1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
    { id: 'm2', roundId: 'u1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
    { id: 'm3', roundId: 'f', home: null, away: null, winner: null, status: 'pending', data: null },
  ],
};

const fourTeams: BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    { id: 'u1', name: 'Upper 1', type: 'upper-bracket', data: null },
    { id: 'u2', name: 'Upper 2', type: 'upper-bracket', data: null },
    { id: 'l1', name: 'Lower 1', type: 'lower-bracket', data: null },
    { id: 'l2', name: 'Lower 2', type: 'lower-bracket', data: null },
    { id: 'f', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'u1a', roundId: 'u1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
    { id: 'u1b', roundId: 'u1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
    { id: 'u2a', roundId: 'u2', home: null, away: null, winner: null, status: 'pending', data: null },
    { id: 'l1a', roundId: 'l1', home: null, away: null, winner: null, status: 'pending', data: null },
    { id: 'l2a', roundId: 'l2', home: null, away: null, winner: null, status: 'pending', data: null },
    { id: 'fa', roundId: 'f', home: null, away: null, winner: null, status: 'pending', data: null },
  ],
};

const placement = (grid: ComputedBracketGrid<null, null>) =>
  grid.columns.flatMap((column) =>
    column.elements.flatMap((element) =>
      element.type === 'match' ? [`${element.match.id} ${element.dimensions.left},${element.dimensions.top}`] : [],
    ),
  );

describe('createDoubleEliminationGrid', () => {
  it('reports ET3405 for a double elimination without lower rounds', () => {
    const bracket = createBracket(withoutLowerRounds, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(() => createDoubleEliminationGrid(bracket, CONFIG, COMPONENTS)).toThrowError(/^ET3405:/);
  });

  it('lays the upper bracket above the lower one, each round in its own column', () => {
    const bracket = createBracket(fourTeams, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(placement(createDoubleEliminationGrid(bracket, CONFIG, COMPONENTS))).toEqual([
      'u1a 0,0',
      'u1b 0,90',
      'l1a 0,170',
      'u2a 250,45',
      'l2a 250,170',
      'fa 500,45',
    ]);
  });
});

describe('double elimination sections', () => {
  const sectionBoxes = (grid: ComputedBracketGrid<null, null>) =>
    grid.sections?.map((section) => ({
      key: section.key,
      name: section.name,
      rounds: section.rounds.map((round) => round.id),
      title: section.titleDimensions,
    }));

  it('reserves a title band above the upper bracket, the finals and the lower bracket', () => {
    const bracket = createBracket(fourTeams, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const grid = createDoubleEliminationGrid(bracket, { ...CONFIG, sectionTitleHeight: 40 }, COMPONENTS);

    expect(placement(grid)).toEqual(['u1a 0,40', 'u1b 0,130', 'l1a 0,250', 'u2a 250,85', 'l2a 250,250', 'fa 500,85']);

    expect(sectionBoxes(grid)).toEqual([
      {
        key: 'upper',
        name: 'Upper bracket',
        rounds: ['u1', 'u2'],
        title: { top: 0, left: 0, width: 450, height: 40 },
      },
      {
        key: 'lower',
        name: 'Lower bracket',
        rounds: ['l1', 'l2'],
        title: { top: 210, left: 0, width: 450, height: 40 },
      },
      { key: 'finals', name: 'Finals', rounds: ['f'], title: { top: 0, left: 500, width: 200, height: 40 } },
    ]);
  });

  it('keeps the grid as it was without a title height, and still reports the sections', () => {
    const bracket = createBracket(fourTeams, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const grid = createDoubleEliminationGrid(bracket, CONFIG, COMPONENTS);

    expect(placement(grid)).toEqual(['u1a 0,0', 'u1b 0,90', 'l1a 0,170', 'u2a 250,45', 'l2a 250,170', 'fa 500,45']);
    expect(grid.sections?.map((section) => [section.key, section.titleDimensions.top, section.dimensions.top])).toEqual(
      [
        ['upper', 0, 0],
        ['lower', 170, 170],
        ['finals', 0, 0],
      ],
    );
  });

  it('counts the bracket reset and the third place playoff as finals', () => {
    const round = (type: string) => ({ type }) as Parameters<typeof doubleEliminationRoundSection>[0];

    expect(doubleEliminationRoundSection(round('upper-bracket'))).toBe(BRACKET_SECTION_KEY.UPPER);
    expect(doubleEliminationRoundSection(round('lower-bracket'))).toBe(BRACKET_SECTION_KEY.LOWER);
    expect(doubleEliminationRoundSection(round('final'))).toBe(BRACKET_SECTION_KEY.FINALS);
    expect(doubleEliminationRoundSection(round('reverse-final'))).toBe(BRACKET_SECTION_KEY.FINALS);
    expect(doubleEliminationRoundSection(round('third-place'))).toBe(BRACKET_SECTION_KEY.FINALS);
  });
});

describe('createStackedDoubleEliminationGrid', () => {
  it('folds the upper bracket around its centre and stacks the final and the lower bracket beneath', () => {
    const layout = BRACKET_DATA_LAYOUT.MIRRORED;
    const bracket = createBracket(fourTeams, { layout });

    expect(placement(createStackedDoubleEliminationGrid(bracket, config(layout), COMPONENTS))).toEqual([
      'u1a 0,0',
      'u2a 250,0',
      'fa 250,80',
      'l1a 250,160',
      'l2a 250,240',
      'u1b 500,0',
    ]);
  });
});
