import { describe, expect, it } from 'vitest';
import { ModelPrice, PriceTable, costOfTurns, costOfUsage, priceAt } from './price';
import { BUILT_IN_PRICES } from './built-in-prices';

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

describe('built-in prices', () => {
  const builtIn = BUILT_IN_PRICES[0] as ModelPrice;
  const usd = (...prices: ModelPrice[]): PriceTable => ({ currency: 'USD', prices });
  const turn = (at: Date) => ({ at, provider: builtIn.provider, model: builtIn.model, usage: usage(1_000_000) });
  const lookup = (options: { table: PriceTable; at: Date }) =>
    priceAt({ ...options, provider: builtIn.provider, model: builtIn.model });

  it('prices a known model from an empty USD table', () => {
    expect(costOfTurns({ table: usd(), turns: [turn(builtIn.from)] })).toEqual({
      currency: 'USD',
      cost: builtIn.input,
      unpriced: [],
    });
  });

  it('never applies before its own date', () => {
    const before = new Date(builtIn.from.getTime() - 1);

    expect(lookup({ table: usd(), at: before })).toBeUndefined();
    expect(costOfTurns({ table: usd(), turns: [turn(before)] }).cost).toBeUndefined();
  });

  it('lets a user price for the same model win from its date, and no earlier', () => {
    const override = { ...builtIn, from: new Date(builtIn.from.getTime() + 86_400_000), input: 99 };
    const prices = usd(override);

    expect(lookup({ table: prices, at: override.from })?.input).toBe(99);
    expect(lookup({ table: prices, at: new Date(override.from.getTime() - 1) })?.input).toBe(builtIn.input);
  });

  it('prefers any user price dated on or before the turn, even one older than the built-in date', () => {
    const early = { ...builtIn, from: new Date(builtIn.from.getTime() - 86_400_000), input: 77 };

    expect(lookup({ table: usd(early), at: builtIn.from })?.input).toBe(77);
    expect(lookup({ table: usd(early), at: new Date(early.from.getTime() - 1) })).toBeUndefined();
  });

  it('stays unpriced in another currency, and names the model', () => {
    expect(costOfTurns({ table: table(), turns: [turn(builtIn.from)] })).toEqual({
      currency: 'EUR',
      unpriced: [{ provider: builtIn.provider, model: builtIn.model }],
    });
  });

  it('still uses the user price in another currency', () => {
    const own = { ...builtIn, input: 3 };

    expect(costOfTurns({ table: table(own), turns: [turn(builtIn.from)] }).cost).toBe(3);
  });
});
