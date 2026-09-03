import { BRACKET_DATA_LAYOUT, BracketMatchId, SINGLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { BracketDataSource, BracketSlotSource } from '../integrations';
import { createBracket } from './bracket';
import { BracketPickSet, resolveBracketSlot } from './resolve-bracket-slot';

const source = (overrides: Partial<BracketDataSource<null, null>> = {}): BracketDataSource<null, null> => ({
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
    { id: 'm1', roundId: 'r1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
    { id: 'm2', roundId: 'r1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
    {
      id: 'm3',
      roundId: 'r2',
      home: null,
      away: null,
      homeSource: matchOutcome('m1', 'winner'),
      awaySource: matchOutcome('m2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
  ...overrides,
});

const matchOutcome = (matchId: string, role: 'winner' | 'loser'): BracketSlotSource => ({
  kind: 'match-outcome',
  role,
  matchId,
  standingId: null,
  rank: null,
  label: null,
});

const picks = (winners: Record<string, string | null>): BracketPickSet => ({
  matchWinner: (matchId) => winners[matchId] ?? null,
  standingRank: () => null,
});

describe('resolveBracketSlot', () => {
  it('follows the viewer picks through match outcomes without replacing them with results', () => {
    const bracket = createBracket(source(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(resolveBracketSlot({ bracket, picks: picks({ m1: 'b', m2: 'c' }), matchId: 'm3', side: 'home' })).toBe('b');
    expect(resolveBracketSlot({ bracket, picks: picks({ m1: 'b', m2: 'c' }), matchId: 'm3', side: 'away' })).toBe('c');
  });

  it('resolves a loser only after both feeder sides and its winner resolve', () => {
    const predictionSource = source();
    predictionSource.matches[2] = {
      ...predictionSource.matches[2]!,
      homeSource: matchOutcome('m1', 'loser'),
    };
    const bracket = createBracket(predictionSource, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(resolveBracketSlot({ bracket, picks: picks({ m1: null }), matchId: 'm3', side: 'home' })).toBeNull();
    expect(resolveBracketSlot({ bracket, picks: picks({ m1: 'a' }), matchId: 'm3', side: 'home' })).toBe('b');
  });

  it('advances the occupied side of a bye without requiring a pick', () => {
    const predictionSource = source();
    predictionSource.matches[0] = {
      ...predictionSource.matches[0]!,
      away: null,
      awaySource: {
        kind: 'bye',
        role: null,
        matchId: null,
        standingId: null,
        rank: null,
        label: 'Bye',
      },
    };
    const bracket = createBracket(predictionSource, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(resolveBracketSlot({ bracket, picks: picks({}), matchId: 'm3', side: 'home' })).toBe('a');
  });

  it('returns null for a cycle in malformed provenance', () => {
    const predictionSource = source();
    predictionSource.matches[0] = {
      ...predictionSource.matches[0]!,
      home: null,
      homeSource: matchOutcome('m3', 'winner'),
    };
    const bracket = createBracket(predictionSource, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(resolveBracketSlot({ bracket, picks: picks({ m1: 'a', m3: 'a' }), matchId: 'm3', side: 'home' })).toBeNull();
  });
});

describe('declared match graph', () => {
  it('uses slot provenance instead of round positions', () => {
    const bracket = createBracket(source(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const final = bracket.matches.getOrThrow('m3' as BracketMatchId);

    expect(final.relation.type).toBe('two-to-nothing');
    if (final.relation.type !== 'two-to-nothing') return;

    expect(final.relation.previousUpperMatch.id).toBe('m1');
    expect(final.relation.previousLowerMatch.id).toBe('m2');
  });
});
