import { BRACKET_DATA_LAYOUT } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { BracketComponents } from './core';
import { createDoubleEliminationGrid } from './double-elimination';
import { CreateBracketGridConfig } from './types';

const CONFIG: CreateBracketGridConfig = {
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
  layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
};

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

describe('createDoubleEliminationGrid', () => {
  it('reports ET3405 for a double elimination without lower rounds', () => {
    const bracket = createBracket(withoutLowerRounds, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(() => createDoubleEliminationGrid(bracket, CONFIG, COMPONENTS)).toThrowError(/^ET3405:/);
  });
});
