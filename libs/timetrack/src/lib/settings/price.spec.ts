import { describe, expect, it } from 'vitest';
import { ModelPrice, PriceTable } from '../model/price';
import { withModelPrice, withoutModelPrice } from './price';

const priceOf = (change: Partial<ModelPrice> = {}): ModelPrice => ({
  provider: 'claude-code',
  model: 'opus',
  from: new Date('2026-01-01T00:00:00.000Z'),
  input: 15,
  output: 75,
  cacheWrite: 18.75,
  cacheRead: 1.5,
  ...change,
});

const EMPTY: PriceTable = { currency: 'USD', prices: [] };

describe('withModelPrice', () => {
  it('replaces the price of the same model dated at the same instant', () => {
    const table = withModelPrice({ table: EMPTY, price: priceOf() });

    expect(withModelPrice({ table, price: priceOf({ input: 5 }) }).prices).toEqual([priceOf({ input: 5 })]);
  });

  it('keeps a price of the same model dated at another instant', () => {
    const later = priceOf({ from: new Date('2026-06-01T00:00:00.000Z'), input: 5 });
    const table = withModelPrice({ table: withModelPrice({ table: EMPTY, price: priceOf() }), price: later });

    expect(table.prices).toEqual([priceOf(), later]);
  });
});

describe('withoutModelPrice', () => {
  it('removes only the price of that model at that instant', () => {
    const other = priceOf({ model: 'sonnet' });
    const table: PriceTable = { currency: 'EUR', prices: [priceOf(), other] };

    expect(withoutModelPrice({ table, price: priceOf({ input: 1 }) })).toEqual({ currency: 'EUR', prices: [other] });
  });
});
