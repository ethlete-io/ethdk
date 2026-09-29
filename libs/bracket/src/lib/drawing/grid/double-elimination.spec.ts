import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { BracketComponents } from './core';
import { createDoubleEliminationGrid } from './double-elimination';
import { createStackedDoubleEliminationGrid } from './double-elimination-stacked';
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
