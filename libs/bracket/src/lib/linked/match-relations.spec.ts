import { BRACKET_DATA_LAYOUT, BracketMatchId, SINGLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { BracketDataSource, BracketSlotSource } from '../integrations';
import { createBracket } from './bracket';

const matchOutcome = (matchId: string, role: 'winner' | 'loser'): BracketSlotSource => ({
  kind: 'match-outcome',
  role,
  matchId,
  standingId: null,
  rank: null,
  label: null,
});

// The third place match is listed before the final, and both declare the same two semi finals.
const source: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    {
      id: 'r1',
      name: 'Semi-finals',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    { id: 'r2', name: 'Final', type: 'final', data: null },
    { id: 'r3', name: 'Third place', type: 'third-place', data: null },
  ],
  matches: [
    { id: 's1', roundId: 'r1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
    { id: 's2', roundId: 'r1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
    {
      id: 't1',
      roundId: 'r3',
      home: null,
      away: null,
      homeSource: matchOutcome('s1', 'loser'),
      awaySource: matchOutcome('s2', 'loser'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'f1',
      roundId: 'r2',
      home: null,
      away: null,
      homeSource: matchOutcome('s1', 'winner'),
      awaySource: matchOutcome('s2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
};

describe('generateMatchRelations, declared graph', () => {
  it('sends a semi final to the final, not to the third place match', () => {
    const bracket = createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const relation = bracket.matches.getOrThrow('s1' as BracketMatchId).relation;

    expect('nextMatch' in relation ? relation.nextMatch.id : null).toBe('f1');
  });
});
