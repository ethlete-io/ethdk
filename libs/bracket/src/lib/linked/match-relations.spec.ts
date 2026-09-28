import {
  BRACKET_DATA_LAYOUT,
  BracketMatchId,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../core';
import { BracketDataSource, BracketSlotSource } from '../integrations';
import { createBracket } from './bracket';
import { BracketMatchRelation } from './match-relations';

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

const deMatch = (
  id: string,
  roundId: string,
  homeSource: BracketSlotSource | null = null,
  awaySource: BracketSlotSource | null = null,
) => ({
  id,
  roundId,
  home: null,
  away: null,
  homeSource,
  awaySource,
  winner: null,
  status: 'pending' as const,
  data: null,
});

const doubleElimination: BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    { id: 'u1', name: 'Upper 1', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET, data: null },
    { id: 'u2', name: 'Upper 2', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET, data: null },
    { id: 'l1', name: 'Lower 1', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET, data: null },
    { id: 'l2', name: 'Lower 2', type: DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET, data: null },
    { id: 'gf', name: 'Grand final', type: 'final', data: null },
  ],
  matches: [
    deMatch('u1a', 'u1'),
    deMatch('u1b', 'u1'),
    deMatch('u2a', 'u2', matchOutcome('u1a', 'winner'), matchOutcome('u1b', 'winner')),
    deMatch('l1a', 'l1', matchOutcome('u1a', 'loser'), matchOutcome('u1b', 'loser')),
    deMatch('l2a', 'l2', matchOutcome('l1a', 'winner'), matchOutcome('u2a', 'loser')),
    deMatch('gfa', 'gf', matchOutcome('u2a', 'winner'), matchOutcome('l2a', 'winner')),
  ],
};

describe('generateMatchRelations, declared double elimination', () => {
  const relationOf = (matchId: string) =>
    createBracket(doubleElimination, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }).matches.getOrThrow(
      matchId as BracketMatchId,
    ).relation;

  it('does not draw a loser feed as a previous match', () => {
    expect(relationOf('l1a').type).toBe('nothing-to-one');

    const relation = relationOf('l2a');

    expect(relation.type).toBe('one-to-one');
    expect('previousMatch' in relation ? relation.previousMatch.id : null).toBe('l1a');
  });

  it('keeps the upper bracket match leading to its winner', () => {
    const relation = relationOf('u2a');

    expect('nextMatch' in relation ? relation.nextMatch.id : null).toBe('gfa');
  });
});

describe('generateMatchRelations, positional graph', () => {
  const positional = (matchCounts: number[]): BracketDataSource<null, null> => ({
    mode: 'single-elimination',
    rounds: matchCounts.map((_, roundIndex) => ({
      id: `r${roundIndex}`,
      name: `Round ${roundIndex}`,
      type:
        roundIndex === matchCounts.length - 1
          ? 'final'
          : SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
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

  const feedersOf = (relation: BracketMatchRelation<null, null>) =>
    'previousMatch' in relation
      ? [relation.previousMatch.id]
      : 'previousUpperMatch' in relation
        ? [relation.previousUpperMatch.id, relation.previousLowerMatch.id]
        : [];

  it('names every match as the feeder of the match it leads to in a field that is not a power of two', () => {
    const bracket = createBracket(positional([3, 2, 1]), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const matches = [...bracket.matches.values()];

    for (const match of matches) {
      if (!('nextMatch' in match.relation)) continue;

      expect(feedersOf(match.relation.nextMatch.relation)).toContain(match.id);
    }

    for (const match of matches) {
      for (const feederId of feedersOf(match.relation)) {
        const feeder = bracket.matches.getOrThrow(feederId as BracketMatchId);

        expect('nextMatch' in feeder.relation ? feeder.relation.nextMatch.id : null).toBe(match.id);
      }
    }
  });
});
