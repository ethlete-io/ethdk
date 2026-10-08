import { BUILT_IN_PRICES } from './built-in-prices';
import { AgentUsageEvent, TokenUsage } from './event';

export { BUILT_IN_PRICES, BUILT_IN_PRICES_CHECKED } from './built-in-prices';

const BUILT_IN_CURRENCY = 'USD';

const PER_MILLION = 1_000_000;

/**
 * What one model of one provider costs per million tokens of each class, from `from` on. Thinking has no
 * rate: it is part of output and priced with it.
 */
export type ModelPrice = {
  provider: string;
  model: string;
  /** The first instant the price holds. A later price for the same model replaces it from its own `from`. */
  from: Date;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

/** The user's own prices, all in one currency: overrides of the built-in list and models it does not know. */
export type PriceTable = {
  currency: string;
  prices: readonly ModelPrice[];
};

export type UnpricedModel = { provider: string; model: string };

export type SpendCost = {
  currency: string;
  /** Absent when any turn ran on a model the table has no price for at that turn's instant. */
  cost?: number;
  /** The models with no price at the instant one of their turns ran, first seen first. */
  unpriced: UnpricedModel[];
};

const latestAt = (options: { prices: readonly ModelPrice[]; provider: string; model: string; at: Date }) =>
  options.prices
    .filter(
      (price) =>
        price.provider === options.provider &&
        price.model === options.model &&
        price.from.getTime() <= options.at.getTime(),
    )
    .reduce<ModelPrice | undefined>(
      (latest, price) => (!latest || price.from > latest.from ? price : latest),
      undefined,
    );

/**
 * The price that held for a model at an instant. The user's latest price dated at or before it wins;
 * otherwise the built-in one, which is in USD and so applies only to a USD table. A price added later
 * with a later date never reprices a turn before that date.
 */
export const priceAt = (options: {
  table: PriceTable;
  provider: string;
  model: string;
  at: Date;
}): ModelPrice | undefined =>
  latestAt({ ...options, prices: options.table.prices }) ??
  (options.table.currency === BUILT_IN_CURRENCY ? latestAt({ ...options, prices: BUILT_IN_PRICES }) : undefined);

/** What a spend costs at one price. */
export const costOfUsage = (usage: TokenUsage, price: ModelPrice) =>
  (usage.input * price.input +
    usage.output * price.output +
    usage.cacheWrite * price.cacheWrite +
    usage.cacheRead * price.cacheRead) /
  PER_MILLION;

/** What a set of turns cost, each at the price that held for its model when it ran. */
export const costOfTurns = (options: {
  table: PriceTable;
  turns: readonly Pick<AgentUsageEvent, 'at' | 'provider' | 'model' | 'usage'>[];
}): SpendCost => {
  const unpriced: UnpricedModel[] = [];
  let cost = 0;

  for (const turn of options.turns) {
    const price = priceAt({ table: options.table, provider: turn.provider, model: turn.model, at: turn.at });

    if (price) {
      cost += costOfUsage(turn.usage, price);
      continue;
    }

    if (!unpriced.some((known) => known.provider === turn.provider && known.model === turn.model)) {
      unpriced.push({ provider: turn.provider, model: turn.model });
    }
  }

  return unpriced.length
    ? { currency: options.table.currency, unpriced }
    : { currency: options.table.currency, cost, unpriced };
};
