import { ModelPrice, PriceTable } from '../model/price';

const samePrice = (a: ModelPrice, b: ModelPrice) =>
  a.provider === b.provider && a.model === b.model && a.from.getTime() === b.from.getTime();

/** Adds a price, replacing the one dated at the same instant for the same model. */
export const withModelPrice = (options: { table: PriceTable; price: ModelPrice }): PriceTable => ({
  ...options.table,
  prices: [...options.table.prices.filter((price) => !samePrice(price, options.price)), options.price],
});

export const withoutModelPrice = (options: { table: PriceTable; price: ModelPrice }): PriceTable => ({
  ...options.table,
  prices: options.table.prices.filter((price) => !samePrice(price, options.price)),
});
