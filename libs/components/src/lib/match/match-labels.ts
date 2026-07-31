import { createLabels } from '@ethlete/core';
import { NormalizedMatchStatus } from './match.types';

/** What a match card announces about itself, once composed. */
export type MatchCardNameContext = {
  /** The home side's display name, or the `tbd` label when the slot is empty. */
  home: string;
  /** The away side's display name, or the `tbd` label. */
  away: string;
  /** The score as one string (`'2 : 1'`), or `null` before there is one. */
  score: string | null;
  /** The kick-off, already formatted for the active locale, or `null` when unscheduled. */
  startTime: string | null;
  status: NormalizedMatchStatus;
};

/**
 * Every string the match components render or announce. Defaults are English
 * ({@link DEFAULT_MATCH_LABELS}); override them app-wide with {@link provideMatchLabels} or per
 * instance via the `labels` input.
 */
export type MatchLabels = {
  /** Stands in for a participant that isn't decided yet. */
  tbd: string;
  /** The live badge's text. */
  live: string;
  /** Announced for a finished match, and shown where a status word is drawn. */
  finished: string;
  /** Announced for a match that hasn't started. */
  scheduled: string;
  /** Separates the two scores, e.g. `' : '`. Also used to build the accessible name. */
  scoreSeparator: string;
  /** Accessible name for a participant's emblem — the image is decorative beside the name. */
  emblemAlt: (participant: string) => string;
  /** A participant's seed, e.g. `'Seed 3'`. */
  seed: (seed: number) => string;
  /**
   * The card's whole accessible name. One string per card, so a screen reader reads the match rather
   * than walking six unrelated fragments.
   */
  matchName: (context: MatchCardNameContext) => string;
  /** Names the per-game breakdown of a series for assistive tech. */
  gameScores: string;
  /** One game of a series, e.g. `'Game 2: 13 : 11'`. */
  gameScore: (game: number, score: string) => string;
};

/** The built-in English labels. */
export const DEFAULT_MATCH_LABELS: MatchLabels = {
  tbd: 'TBD',
  live: 'Live',
  finished: 'Finished',
  scheduled: 'Scheduled',
  scoreSeparator: ' : ',
  emblemAlt: (participant) => `${participant} emblem`,
  seed: (seed) => `Seed ${seed}`,
  // The order matters more than the punctuation: who is playing, then how it stands, then whether it
  // is still going — which is how someone scanning a page of these actually reads them.
  matchName: ({ home, away, score, startTime, status }) => {
    const outcome = score ?? startTime;
    const state = status === 'live' ? 'Live' : status === 'finished' ? 'Finished' : null;

    return [`${home} vs. ${away}`, outcome, state].filter(Boolean).join(', ');
  },
  gameScores: 'Games',
  gameScore: (game, score) => `Game ${game}: ${score}`,
};

/**
 * Localize the match components' strings for everything below this injector, and read the set in
 * effect here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_MATCH_LABELS}
 * value. See {@link createLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideMatchLabels({
 *   tbd: 'Offen',
 *   live: 'Live',
 *   matchName: ({ home, away, score }) => `${home} gegen ${away}${score ? `, ${score}` : ''}`,
 * });
 */
export const [provideMatchLabels, injectMatchLabels, MATCH_LABELS] = createLabels<MatchLabels>(
  'MATCH_LABELS',
  DEFAULT_MATCH_LABELS,
);
