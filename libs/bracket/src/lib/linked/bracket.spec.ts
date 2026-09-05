import {
  BRACKET_DATA_LAYOUT,
  BracketMatchId,
  MatchParticipantId,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../core';
import { BracketDataSource } from '../integrations';
import { createBracket } from './bracket';

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
  ],
  matches: [
    { id: 's1', roundId: 'r1', home: 'a', away: 'b', winner: 'home', status: 'completed', data: null },
    { id: 's2', roundId: 'r1', home: 'c', away: 'd', winner: 'home', status: 'completed', data: null },
    { id: 'f1', roundId: 'r2', home: 'a', away: 'c', winner: null, status: 'pending', data: null },
  ],
};

describe('createBracket', () => {
  it('gives the participant view of a match the same relation as the match itself', () => {
    const bracket = createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    const match = bracket.matches.getOrThrow('s1' as BracketMatchId);
    const participantMatch = bracket.participants
      .getOrThrow('a' as MatchParticipantId)
      .matches.getOrThrow('s1' as BracketMatchId);

    expect(participantMatch.relation).toBe(match.relation);
    expect(participantMatch.relation.type).toBe('nothing-to-one');
  });

  it('reports ET3401 for a source with no rounds', () => {
    expect(() =>
      createBracket({ ...source, rounds: [], matches: [] }, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
    ).toThrowError(/^ET3401:/);
  });

  it('links a stage whose rounds are all still waiting for their draw', () => {
    const bracket = createBracket({ ...source, matches: [] }, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect([...bracket.rounds.keys()]).toEqual(['r1', 'r2']);
    expect(bracket.matches.size).toBe(0);
  });
});
