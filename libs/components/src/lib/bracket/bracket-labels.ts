import { BracketSlotSource } from '@ethlete/bracket';
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
  /** A slot an earlier match's winner walks into. */
  slotMatchWinner: string;
  /** A slot an earlier match's loser drops into. */
  slotMatchLoser: string;
  /** A slot a place in a standing feeds, e.g. `'Group A position 2'`. Either part may be unknown. */
  slotStandingRank: (standing: string | null, rank: number | null) => string;
  /** A slot reserved for a seeding position, e.g. `'Seed 3'`. */
  slotSeed: (seed: number | null) => string;
  /** A slot a swiss round's draw fills, which only happens once the round is scheduled. */
  slotSwissBucket: string;
  /** A slot nobody plays in. */
  slotBye: string;
  /** A slot whoever qualifies from another competition arrives in. */
  slotExternal: string;
  /** A slot the competition says nothing at all about. */
  slotUnknown: string;
  /**
   * A pick-card side the viewer could reach by predicting the round that feeds it, and hasn't. The
   * card's `earlierRoundsClosed` input swaps it for {@link BracketLabels.slotNotPredicted}.
   */
  slotPredictEarlierRound: string;
  /** The same side once no earlier round is left to predict, so the invitation would be a dead end. */
  slotNotPredicted: string;
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
  slotMatchWinner: 'Winner of an earlier match',
  slotMatchLoser: 'Loser of an earlier match',
  slotStandingRank: (standing, rank) => {
    if (standing && rank !== null) return `${standing} position ${rank}`;

    return standing ?? (rank === null ? 'A standing position' : `Standing position ${rank}`);
  },
  slotSeed: (seed) => (seed === null ? 'A seeded slot' : `Seed ${seed}`),
  slotSwissBucket: 'Drawn once the round is scheduled',
  slotBye: 'Bye',
  slotExternal: 'Arrives from another competition',
  slotUnknown: 'Not known yet',
  slotPredictEarlierRound: 'Predict the earlier round first',
  slotNotPredicted: 'Not predicted',
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

/**
 * What a slot with no participant in it is, in one line - the winner of an earlier match, a place in a
 * standing, a seed, a bye. `source.label` always wins: where the competition worded the slot itself,
 * this repeats that word rather than inventing one. A slot with no source at all reads as unknown.
 *
 * @example
 * describeBracketSlot(bracketMatch.homeSource, injectBracketLabels()());
 */
export const describeBracketSlot = (source: BracketSlotSource | null | undefined, labels: BracketLabels) => {
  if (!source) return labels.slotUnknown;
  if (source.label) return source.label;

  switch (source.kind) {
    case 'match-outcome':
      return source.role === 'loser' ? labels.slotMatchLoser : labels.slotMatchWinner;
    case 'standing-rank':
      return labels.slotStandingRank(source.standingName ?? null, source.rank);
    case 'seed':
      return labels.slotSeed(source.seed ?? null);
    case 'swiss-bucket':
      return labels.slotSwissBucket;
    case 'bye':
      return labels.slotBye;
    case 'external':
      return labels.slotExternal;
  }
};
