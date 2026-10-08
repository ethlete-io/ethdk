import { BRACKET_DATA_LAYOUT } from '../core';
import { BracketDataSource, bracketSlot } from '../integrations';
import { createBracket } from './bracket';
import { standingRankSides } from './standing-rank-sides';

const source: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    { id: 'r1', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
    { id: 'r2', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    {
      id: 'm1',
      roundId: 'r1',
      home: null,
      away: 'b2',
      homeSource: bracketSlot.standingRank('a', 1, 'Group A'),
      awaySource: bracketSlot.standingRank('b', 2),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'm2',
      roundId: 'r1',
      home: 'c',
      away: null,
      homeSource: bracketSlot.seed(1),
      awaySource: bracketSlot.standingRank('a', 2),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'm3',
      roundId: 'r2',
      home: null,
      away: null,
      homeSource: bracketSlot.matchOutcome('m1', 'winner'),
      awaySource: bracketSlot.matchOutcome('m2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
};

const bracket = createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

describe('standingRankSides', () => {
  it('lists every standing-rank side of a match, home first', () => {
    expect(standingRankSides({ bracket, matchId: 'm1' })).toEqual([
      { side: 'home', standingId: 'a', rank: 1, standingName: 'Group A', participantId: null },
      { side: 'away', standingId: 'b', rank: 2, standingName: null, participantId: 'b2' },
    ]);
  });

  it('skips sides of any other kind', () => {
    expect(standingRankSides({ bracket, matchId: 'm2' })).toEqual([
      { side: 'away', standingId: 'a', rank: 2, standingName: null, participantId: null },
    ]);
    expect(standingRankSides({ bracket, matchId: 'm3' })).toEqual([]);
  });

  it('is empty for an unknown match', () => {
    expect(standingRankSides({ bracket, matchId: 'nope' })).toEqual([]);
  });
});
