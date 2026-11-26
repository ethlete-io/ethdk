import { swapStandingRank } from './swap-standing-rank';

describe('swapStandingRank', () => {
  const order = ['a', 'b', 'c', 'd'] as const;

  it('swaps the participant with whoever stood on the rank', () => {
    expect(swapStandingRank({ order, rank: 1, participantId: 'c' })).toEqual(['c', 'b', 'a', 'd']);
  });

  it('returns a new array without touching the input', () => {
    const input = [...order];
    const next = swapStandingRank({ order: input, rank: 2, participantId: 'b' });

    expect(next).toEqual(input);
    expect(next).not.toBe(input);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves the order unchanged for an unknown participant or a rank outside it', () => {
    expect(swapStandingRank({ order, rank: 1, participantId: 'x' })).toEqual(order);
    expect(swapStandingRank({ order, rank: 0, participantId: 'a' })).toEqual(order);
    expect(swapStandingRank({ order, rank: 5, participantId: 'a' })).toEqual(order);
    expect(swapStandingRank({ order, rank: 1.5, participantId: 'b' })).toEqual(order);
  });
});
