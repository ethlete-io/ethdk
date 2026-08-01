import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';
import { StandingsFormResult } from './standings.types';

/**
 * Every string `et-standings` renders or announces. Column headers are abbreviated on screen and spelled
 * out for assistive tech, which is the whole reason there are two of each.
 */
export type StandingsLabels = {
  /** The table's caption - what this table is a table of. */
  caption: string;
  /** The position column, abbreviated. */
  position: string;
  /** The position column, spelled out. */
  positionFull: string;
  /** The participant column header. */
  participant: string;
  played: string;
  playedFull: string;
  wins: string;
  winsFull: string;
  ties: string;
  tiesFull: string;
  losses: string;
  lossesFull: string;
  difference: string;
  differenceFull: string;
  points: string;
  pointsFull: string;
  form: string;
  formFull: string;
  /** One entry of the form column, e.g. `'Win'`. */
  formResult: (result: StandingsFormResult) => string;
  /** Names the zone legend for assistive tech. */
  legend: string;
  /** Announced on the highlighted row, so it is findable without seeing the highlight. */
  highlightedRow: string;
};

/** The built-in English labels. */
export const DEFAULT_STANDINGS_LABELS: StandingsLabels = {
  caption: 'Standings',
  position: '#',
  positionFull: 'Position',
  participant: 'Team',
  played: 'P',
  playedFull: 'Played',
  wins: 'W',
  winsFull: 'Wins',
  ties: 'D',
  tiesFull: 'Draws',
  losses: 'L',
  lossesFull: 'Losses',
  difference: 'Diff',
  differenceFull: 'Difference',
  points: 'Pts',
  pointsFull: 'Points',
  form: 'Form',
  formFull: 'Recent form, oldest first',
  formResult: (result) => (result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Draw'),
  legend: 'What the highlighted positions mean',
  highlightedRow: 'Your team',
};

const STANDINGS_LABELS_DEF = /* @__PURE__ */ defineLabels<StandingsLabels>(
  'STANDINGS_LABELS',
  DEFAULT_STANDINGS_LABELS,
);

/**
 * Localize the standings table for everything below this injector. Partial - whatever you leave out keeps
 * its {@link DEFAULT_STANDINGS_LABELS} value.
 *
 * @example
 * provideStandingsLabels({ caption: 'Tabelle', participant: 'Verein', points: 'Pkt', pointsFull: 'Punkte' });
 */
export const provideStandingsLabels = /* @__PURE__ */ toProvideFn(STANDINGS_LABELS_DEF);
export const injectStandingsLabels = /* @__PURE__ */ toInjectFn(STANDINGS_LABELS_DEF);
export const STANDINGS_LABELS = /* @__PURE__ */ toToken(STANDINGS_LABELS_DEF);
