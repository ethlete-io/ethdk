import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';
import { NormalizedMatchResultKind, NormalizedMatchStatus } from './match.types';

/** The two headline values of a match, for the label that turns them into a phrase. */
export type MatchResultNameContext = {
  /** The home side's value, as drawn (`'2'`, `'3'`), or `null` when the match reports no values. */
  home: string | null;
  /** The away side's value, as drawn, or `null`. */
  away: string | null;
  /** What the two values are - see {@link NormalizedMatchResultKind}. */
  kind: NormalizedMatchResultKind;
  /** The winning side's display name, or `null` while undecided or drawn. */
  winner: string | null;
  /** The `scoreSeparator` in effect, passed in so this label honours an override of it. */
  separator: string;
};

/** What a match card announces about itself, once composed. */
export type MatchCardNameContext = {
  /** The home side's display name, or the `tbd` label when the slot is empty. */
  home: string;
  /** The away side's display name, or the `tbd` label. */
  away: string;
  /**
   * How it stands, as the `resultName` label phrased it (`'2 : 1'`, `'FC Berlin won'`), or `null`
   * before there is a result.
   */
  result: string | null;
  /** What the underlying two values are, in case the phrasing should turn on it. */
  resultKind: NormalizedMatchResultKind;
  /** The winning side's display name, or `null` while undecided or drawn. */
  winner: string | null;
  /** The kick-off, already formatted for the active locale, or `null` when unscheduled. */
  startTime: string | null;
  status: NormalizedMatchStatus;
  /** The match's own `label` (`'Grand Final'`), or `null` when it has none. */
  label: string | null;
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
  /**
   * How the result is announced - which is not how it is drawn. `'W'` beside `'L'` reads fine and
   * listens terribly, so a match with no values to read names its winner instead, and `points` says
   * what the numbers are.
   */
  resultName: (context: MatchResultNameContext) => string;
  /** Sits between the two sides in the wide row, where a match has no result yet. */
  versus: string;
  /** The winning side's letter, for a match whose `resultKind` is `'outcome'`. */
  outcomeWin: string;
  /** The losing side's letter. */
  outcomeLoss: string;
  /** Both sides' letter for a drawn match. */
  outcomeDraw: string;
  /** Accessible name for a participant's emblem - the image is decorative beside the name. */
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
  resultName: ({ home, away, kind, winner, separator }) => {
    // Nothing numeric to read: a competition that reports only wins and losses still has an outcome,
    // and "W" is not it.
    if (home === null || away === null) return winner ? `${winner} won` : 'Draw';

    const pair = `${home}${separator}${away}`;

    return kind === 'points' ? `${pair} points` : pair;
  },
  versus: 'vs',
  outcomeWin: 'W',
  outcomeLoss: 'L',
  outcomeDraw: 'D',
  emblemAlt: (participant) => `${participant} emblem`,
  seed: (seed) => `Seed ${seed}`,
  // The order matters more than the punctuation: which match this is, who is playing, then how it
  // stands, then whether it is still going - which is how someone scanning a page of these actually
  // reads them.
  matchName: ({ home, away, result, startTime, status, label }) => {
    const outcome = result ?? startTime;
    const state = status === 'live' ? 'Live' : status === 'finished' ? 'Finished' : null;
    const matchUp = label ? `${label}: ${home} vs. ${away}` : `${home} vs. ${away}`;

    return [matchUp, outcome, state].filter(Boolean).join(', ');
  },
  gameScores: 'Games',
  gameScore: (game, score) => `Game ${game}: ${score}`,
};

const MATCH_LABELS_DEF = /* @__PURE__ */ defineLabels<MatchLabels>('MATCH_LABELS', DEFAULT_MATCH_LABELS);

/**
 * Localize the match components' strings for everything below this injector, and read the set in
 * effect here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_MATCH_LABELS}
 * value. See {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideMatchLabels({
 *   tbd: 'Offen',
 *   live: 'Live',
 *   matchName: ({ home, away, result }) => `${home} gegen ${away}${result ? `, ${result}` : ''}`,
 * });
 */
export const provideMatchLabels = /* @__PURE__ */ toProvideFn(MATCH_LABELS_DEF);
export const injectMatchLabels = /* @__PURE__ */ toInjectFn(MATCH_LABELS_DEF);
export const MATCH_LABELS = /* @__PURE__ */ toToken(MATCH_LABELS_DEF);
