import { BRACKET_DATA_LAYOUT, BracketMatchId, SINGLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { BracketDataSource, BracketSlotSource } from '../integrations';
import { BracketMatch, createBracket } from './bracket';
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

/** A legal, acyclic chain in which every match is fed by both outcomes of the one before it. */
const rematchChain = (length: number): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: Array.from({ length }, (_, index) => ({
    id: `r${index}`,
    name: `Round ${index}`,
    type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
    data: null,
  })),
  matches: Array.from({ length }, (_, index) => ({
    id: `m${index}`,
    roundId: `r${index}`,
    home: index === 0 ? 'a' : null,
    away: index === 0 ? 'b' : null,
    homeSource: index === 0 ? undefined : matchOutcome(`m${index - 1}`, 'winner'),
    awaySource: index === 0 ? undefined : matchOutcome(`m${index - 1}`, 'loser'),
    winner: null,
    status: 'pending' as const,
    data: null,
  })),
});

describe('resolveBracketSlot, shared feeders', () => {
  it('walks a chain of rematches once per slot rather than once per path', () => {
    const length = 20;
    const bracket = createBracket(rematchChain(length), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    let matchWinnerCalls = 0;
    const countingPicks: BracketPickSet = {
      matchWinner: (matchId) => {
        matchWinnerCalls++;
        return matchId === 'm0' ? 'a' : null;
      },
      standingRank: () => null,
    };

    resolveBracketSlot({ bracket, picks: countingPicks, matchId: `m${length - 1}`, side: 'home' });

    expect(matchWinnerCalls).toBeLessThan(length * 4);
  });
});

/** Two seeded pairs into a semi-final each, both semis already carrying a real pairing, into a final. */
const semisWithRealPairings = (): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: [
    {
      id: 'r1',
      name: 'Quarter-finals',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    {
      id: 'r2',
      name: 'Semi-finals',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    { id: 'r3', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'm1', roundId: 'r1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
    { id: 'm2', roundId: 'r1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
    { id: 'm3', roundId: 'r1', home: 'e', away: 'f', winner: null, status: 'pending', data: null },
    { id: 'm4', roundId: 'r1', home: 'g', away: 'h', winner: null, status: 'pending', data: null },
    {
      id: 'm5',
      roundId: 'r2',
      home: 'c',
      away: 'd',
      homeSource: matchOutcome('m1', 'winner'),
      awaySource: matchOutcome('m2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'm6',
      roundId: 'r2',
      home: 'g',
      away: 'h',
      homeSource: matchOutcome('m3', 'winner'),
      awaySource: matchOutcome('m4', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'm7',
      roundId: 'r3',
      home: null,
      away: null,
      homeSource: matchOutcome('m5', 'winner'),
      awaySource: matchOutcome('m6', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
});

describe('resolveBracketSlot, realParticipantOutranksPick', () => {
  const bracket = () => createBracket(semisWithRealPairings(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
  const madePicks = picks({ m1: 'a', m2: 'c', m3: 'e', m4: 'g', m5: 'd', m6: 'e' });

  it('ignores the real participant by default', () => {
    expect(resolveBracketSlot({ bracket: bracket(), picks: madePicks, matchId: 'm7', side: 'home' })).toBeNull();
    expect(resolveBracketSlot({ bracket: bracket(), picks: madePicks, matchId: 'm7', side: 'away' })).toBe('e');
  });

  it('answers with the real participant wherever the predicate says it outranks the prediction', () => {
    const options = { bracket: bracket(), picks: madePicks, realParticipantOutranksPick: () => true };

    expect(resolveBracketSlot({ ...options, matchId: 'm7', side: 'home' })).toBe('d');
    expect(resolveBracketSlot({ ...options, matchId: 'm7', side: 'away' })).toBeNull();
  });

  it('is asked per match, so one open and one locked feeder resolve differently in the same walk', () => {
    const options = {
      bracket: bracket(),
      picks: madePicks,
      realParticipantOutranksPick: (match: BracketMatch<unknown, unknown>) => match.id === 'm5',
    };

    expect(resolveBracketSlot({ ...options, matchId: 'm7', side: 'home' })).toBe('d');
    expect(resolveBracketSlot({ ...options, matchId: 'm7', side: 'away' })).toBe('e');
  });

  it('still answers a standing-rank slot from the picks while no real participant stands there', () => {
    const predictionSource = source();
    predictionSource.matches[2] = {
      ...predictionSource.matches[2]!,
      homeSource: { kind: 'standing-rank', role: null, matchId: null, standingId: 'g1', rank: 2, label: null },
    };
    const standingPicks: BracketPickSet = {
      matchWinner: () => null,
      standingRank: ({ standingId, rank }) => (standingId === 'g1' && rank === 2 ? 'b' : null),
    };
    const bracketWithStanding = createBracket(predictionSource, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(
      resolveBracketSlot({
        bracket: bracketWithStanding,
        picks: standingPicks,
        matchId: 'm3',
        side: 'home',
        realParticipantOutranksPick: () => true,
      }),
    ).toBe('b');
  });
});

/** A final fed by both outcomes of a semi that is itself fed by two seeded matches. */
const threeRoundsDeep = (): BracketDataSource<null, null> => ({
  mode: 'single-elimination',
  rounds: [
    {
      id: 'r1',
      name: 'Quarter-finals',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    {
      id: 'r2',
      name: 'Semi-final',
      type: SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      data: null,
    },
    { id: 'r3', name: 'Final', type: 'final', data: null },
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
    {
      id: 'm4',
      roundId: 'r3',
      home: null,
      away: null,
      homeSource: matchOutcome('m3', 'winner'),
      awaySource: matchOutcome('m3', 'loser'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
});

describe('resolveBracketSlot, keepPickWhileFeederSideIsOpen', () => {
  const bracket = () => createBracket(threeRoundsDeep(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

  it('drops a predicted winner while one side of its match is still open by default', () => {
    const openSide = picks({ m1: 'a', m3: 'a' });

    expect(resolveBracketSlot({ bracket: bracket(), picks: openSide, matchId: 'm4', side: 'home' })).toBeNull();
  });

  it('keeps a predicted winner while one side of its match is still open', () => {
    const openSide = picks({ m1: 'a', m3: 'a' });

    expect(
      resolveBracketSlot({
        bracket: bracket(),
        picks: openSide,
        matchId: 'm4',
        side: 'home',
        keepPickWhileFeederSideIsOpen: true,
      }),
    ).toBe('a');
  });

  it('drops it once both sides are known and it is neither of them', () => {
    const contradicted = picks({ m1: 'a', m2: 'c', m3: 'z' });

    expect(
      resolveBracketSlot({
        bracket: bracket(),
        picks: contradicted,
        matchId: 'm4',
        side: 'home',
        keepPickWhileFeederSideIsOpen: true,
      }),
    ).toBeNull();
    expect(
      resolveBracketSlot({
        bracket: bracket(),
        picks: picks({ m1: 'a', m2: 'c', m3: 'c' }),
        matchId: 'm4',
        side: 'home',
        keepPickWhileFeederSideIsOpen: true,
      }),
    ).toBe('c');
  });

  it('still refuses a loser while a side of its match is open', () => {
    expect(
      resolveBracketSlot({
        bracket: bracket(),
        picks: picks({ m1: 'a', m3: 'a' }),
        matchId: 'm4',
        side: 'away',
        keepPickWhileFeederSideIsOpen: true,
      }),
    ).toBeNull();
  });

  it('terminates on a cycle in malformed provenance without caching the guarded answer', () => {
    const predictionSource = source();
    predictionSource.matches[0] = {
      ...predictionSource.matches[0]!,
      home: null,
      homeSource: matchOutcome('m3', 'winner'),
    };
    const cyclic = createBracket(predictionSource, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });

    expect(
      resolveBracketSlot({
        bracket: cyclic,
        picks: picks({ m1: 'a', m3: 'a' }),
        matchId: 'm3',
        side: 'home',
        keepPickWhileFeederSideIsOpen: true,
      }),
    ).toBe('a');
  });
});
