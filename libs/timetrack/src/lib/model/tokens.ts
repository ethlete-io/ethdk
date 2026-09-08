import { TokenUsage } from './event';

const scaled = (value: number) => (value >= 100 ? `${Math.round(value)}` : value.toFixed(1));

/** A token count the way a day reads it — `604 M`, `12.3 k`, `840`. */
export const formatTokenCount = (tokens: number) => {
  if (tokens >= 1_000_000) return `${scaled(tokens / 1_000_000)} M`;
  if (tokens >= 1_000) return `${scaled(tokens / 1_000)} k`;

  return `${Math.round(tokens)}`;
};

/** Every class of one spend summed. A cost needs the classes apart; a "did it spend anything" does not. */
export const totalTokens = (usage: TokenUsage) => usage.input + usage.output + usage.cacheWrite + usage.cacheRead;
