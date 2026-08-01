import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the bracket's default cards render or announce. Defaults are English
 * ({@link DEFAULT_BRACKET_LABELS}); override them app-wide with {@link provideBracketLabels}.
 *
 * The match cards themselves draw no strings of their own - those come from the match domain's
 * `provideMatchLabels`, since the cards are `et-match-card`s.
 */
export type BracketLabels = {
  /** A round header's match count, e.g. `'4 matches'`. */
  roundMatchCount: (matches: number) => string;
  /** The continue card's headline, e.g. `'2 winners advance'`. */
  winnersAdvance: (winners: number) => string;
  /** Names the continue card for assistive tech, since its own text is a fragment. */
  continueLabel: (winners: number) => string;
  /** Announced on the final's card once it has a winner. */
  champion: (participant: string) => string;
  /** Announced on the final's card while it is still to be played. */
  championPending: string;
  /** Heads the winners-bracket rounds in a double-elimination `et-bracket-rounds-list`. */
  upperBracketSection: string;
  /** Heads the losers-bracket rounds in a double-elimination `et-bracket-rounds-list`. */
  lowerBracketSection: string;
  /** Heads the deciding rounds - grand final, bracket reset, third place - in a rounds list. */
  finalsSection: string;
};

/** The built-in English labels. */
export const DEFAULT_BRACKET_LABELS: BracketLabels = {
  roundMatchCount: (matches) => `${matches} ${matches === 1 ? 'match' : 'matches'}`,
  winnersAdvance: (winners) => `${winners} ${winners === 1 ? 'winner' : 'winners'} advance`,
  continueLabel: (winners) => `${winners} ${winners === 1 ? 'winner' : 'winners'} advance to the next stage`,
  champion: (participant) => `Champion: ${participant}`,
  championPending: 'Champion not decided yet',
  upperBracketSection: 'Upper bracket',
  lowerBracketSection: 'Lower bracket',
  finalsSection: 'Finals',
};

const BRACKET_LABELS_DEF = /* @__PURE__ */ defineLabels<BracketLabels>('BRACKET_LABELS', DEFAULT_BRACKET_LABELS);

/**
 * Localize the bracket's default cards for everything below this injector, and read the set in effect
 * here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_BRACKET_LABELS} value.
 *
 * @example
 * provideBracketLabels({
 *   roundMatchCount: (matches) => `${matches} Spiele`,
 *   winnersAdvance: (winners) => `${winners} kommen weiter`,
 * });
 */
export const provideBracketLabels = /* @__PURE__ */ toProvideFn(BRACKET_LABELS_DEF);
export const injectBracketLabels = /* @__PURE__ */ toInjectFn(BRACKET_LABELS_DEF);
export const BRACKET_LABELS = /* @__PURE__ */ toToken(BRACKET_LABELS_DEF);
