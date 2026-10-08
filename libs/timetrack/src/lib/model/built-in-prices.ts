import { CLAUDE_CODE_PROVIDER } from '../agent-session/claude-code';
import { CODEX_PROVIDER } from '../agent-session/codex';
import { ModelPrice } from './price';

/** The day the built-in prices were last compared with the vendors' pricing pages. */
export const BUILT_IN_PRICES_CHECKED = '2026-10-08';

type Rates = Pick<ModelPrice, 'input' | 'output' | 'cacheWrite' | 'cacheRead'>;

/** A model's first built-in price also prices the days before it was checked; a later entry starts at its own date. */
const FIRST = new Date(0);

const anthropic = (model: string, rates: Rates): ModelPrice => ({
  provider: CLAUDE_CODE_PROVIDER,
  model,
  from: FIRST,
  ...rates,
});

const openai = (model: string, rates: Rates): ModelPrice => ({
  provider: CODEX_PROVIDER,
  model,
  from: FIRST,
  ...rates,
});

/**
 * USD per million tokens, standard tier, prompts up to 100K / 272K tokens. A price in the user's own
 * table for the same model wins from its own date.
 */
export const BUILT_IN_PRICES: readonly ModelPrice[] = [
  anthropic('claude-opus-5-5', { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 }),
  anthropic('claude-opus-5', { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }),
  anthropic('claude-opus-4-8', { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }),
  anthropic('claude-opus-4-7', { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }),
  anthropic('claude-opus-4-6', { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }),
  anthropic('claude-sonnet-5-5', { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 }),
  anthropic('claude-sonnet-5', { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 }),
  anthropic('claude-sonnet-4-6', { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }),
  anthropic('claude-haiku-5-5', { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 }),
  anthropic('claude-haiku-4-5', { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 }),
  openai('gpt-6-astra', { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 }),
  openai('gpt-6.1-sol', { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 }),
  openai('gpt-6-sol', { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 }),
  openai('gpt-6-luna', { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 }),
  openai('gpt-5.6-sol', { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.4 }),
  openai('gpt-5.6-terra', { input: 2, output: 12, cacheWrite: 2.5, cacheRead: 0.2 }),
  openai('gpt-5.6-luna', { input: 0.2, output: 1.2, cacheWrite: 0.25, cacheRead: 0.02 }),
];
