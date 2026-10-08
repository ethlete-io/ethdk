import { BracketSlotSource } from './base';
import { bracketSlot } from './bracket-slot';

describe('bracketSlot', () => {
  it('builds every kind with a null label by default', () => {
    expect(bracketSlot.matchOutcome('m1', 'loser')).toEqual({
      kind: 'match-outcome',
      matchId: 'm1',
      role: 'loser',
      label: null,
    });
    expect(bracketSlot.standingRank('g1', 2)).toEqual({
      kind: 'standing-rank',
      standingId: 'g1',
      rank: 2,
      standingName: null,
      label: null,
    });
    expect(bracketSlot.seed(3)).toEqual({ kind: 'seed', seed: 3, label: null });
    expect(bracketSlot.swissBucket()).toEqual({ kind: 'swiss-bucket', label: null });
    expect(bracketSlot.bye()).toEqual({ kind: 'bye', label: null });
    expect(bracketSlot.external('From the qualifiers')).toEqual({ kind: 'external', label: 'From the qualifiers' });
  });

  it('passes the optional label and standing name through', () => {
    expect(bracketSlot.matchOutcome('m1', 'winner', 'Winner SF1').label).toBe('Winner SF1');
    expect(bracketSlot.standingRank('g1', 1, 'Group A', 'A1')).toMatchObject({ standingName: 'Group A', label: 'A1' });
    expect(bracketSlot.seed(1, 'Top seed').label).toBe('Top seed');
    expect(bracketSlot.swissBucket('2-1').label).toBe('2-1');
    expect(bracketSlot.bye('Bye').label).toBe('Bye');
  });
});

describe('BracketSlotSource', () => {
  it('accepts only the fields of its kind', () => {
    const valid: BracketSlotSource[] = [
      { kind: 'match-outcome', matchId: 'm1', role: 'winner' },
      { kind: 'standing-rank', standingId: 'g1', rank: 1 },
      { kind: 'bye' },
    ];

    // @ts-expect-error a seed slot has no role or match
    const seedWithMatch: BracketSlotSource = { kind: 'seed', role: 'winner', matchId: 'x' };
    // @ts-expect-error a match outcome needs its match and role
    const outcomeWithoutMatch: BracketSlotSource = { kind: 'match-outcome' };
    // @ts-expect-error a standing rank needs a numeric rank
    const rankWithoutNumber: BracketSlotSource = { kind: 'standing-rank', standingId: 'g1', rank: null };

    expect([valid, seedWithMatch, outcomeWithoutMatch, rankWithoutNumber]).toHaveLength(4);
  });
});
