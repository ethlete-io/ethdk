import { describe, expect, it } from 'vitest';
import { ModelPrice, PriceTable, costOfTurns, costOfUsage, priceAt } from './price';

const opus = (from: string, input: number): ModelPrice => ({
  provider: 'claude-code',
  model: 'opus',
  from: new Date(from),
  input,
  output: 10,
  cacheWrite: 2,
  cacheRead: 0.5,
});

const table = (...prices: ModelPrice[]): PriceTable => ({ currency: 'EUR', prices });

const usage = (input: number) => ({ input, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 });

describe('priceAt', () => {
  it('takes the latest price dated at or before the instant', () => {
    const prices = table(opus('2026-09-01T00:00:00Z', 5), opus('2026-10-01T00:00:00Z', 3));

    expect(
      priceAt({ table: prices, provider: 'claude-code', model: 'opus', at: new Date('2026-09-15T00:00:00Z') })?.input,
    ).toBe(5);
    expect(
      priceAt({ table: prices, provider: 'claude-code', model: 'opus', at: new Date('2026-10-01T00:00:00Z') })?.input,
    ).toBe(3);
  });

  it('has no price before the first one, or for another provider of the same model', () => {
    const prices = table(opus('2026-09-01T00:00:00Z', 5));

    expect(
      priceAt({ table: prices, provider: 'claude-code', model: 'opus', at: new Date('2026-08-31T23:59:59Z') }),
    ).toBeUndefined();
    expect(
      priceAt({ table: prices, provider: 'codex', model: 'opus', at: new Date('2026-09-15T00:00:00Z') }),
    ).toBeUndefined();
  });
});

describe('costOfUsage', () => {
  it('prices thinking as part of output, never on top of it', () => {
    const price = opus('2026-09-01T00:00:00Z', 5);

    expect(
      costOfUsage(
        { input: 1_000_000, output: 2_000_000, cacheWrite: 1_000_000, cacheRead: 4_000_000, thinking: 1_000_000 },
        price,
      ),
    ).toBe(5 + 20 + 2 + 2);
  });
});

describe('costOfTurns', () => {
  it('prices each turn at the price of its own instant', () => {
    const prices = table(opus('2026-09-01T00:00:00Z', 5), opus('2026-10-01T00:00:00Z', 3));

    expect(
      costOfTurns({
        table: prices,
        turns: [
          { at: new Date('2026-09-30T12:00:00Z'), provider: 'claude-code', model: 'opus', usage: usage(1_000_000) },
          { at: new Date('2026-10-01T12:00:00Z'), provider: 'claude-code', model: 'opus', usage: usage(1_000_000) },
        ],
      }),
    ).toEqual({ currency: 'EUR', cost: 8, unpriced: [] });
  });

  it('reports no cost while any model has no price, and names each such model once', () => {
    const result = costOfTurns({
      table: table(opus('2026-09-01T00:00:00Z', 5)),
      turns: [
        { at: new Date('2026-09-15T00:00:00Z'), provider: 'claude-code', model: 'opus', usage: usage(1_000_000) },
        { at: new Date('2026-09-15T00:00:00Z'), provider: 'codex', model: 'gpt', usage: usage(1) },
        { at: new Date('2026-09-15T01:00:00Z'), provider: 'codex', model: 'gpt', usage: usage(1) },
      ],
    });

    expect(result).toEqual({ currency: 'EUR', unpriced: [{ provider: 'codex', model: 'gpt' }] });
  });

  it('costs nothing for no turns, and an empty table prices nothing', () => {
    expect(costOfTurns({ table: table(), turns: [] })).toEqual({ currency: 'EUR', cost: 0, unpriced: [] });
    expect(
      costOfTurns({
        table: table(),
        turns: [{ at: new Date('2026-09-15T00:00:00Z'), provider: 'claude-code', model: 'opus', usage: usage(1) }],
      }).cost,
    ).toBeUndefined();
  });
});
