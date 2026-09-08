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
  /** Names the pick list - what the order being arranged is an order of. */
  pickCaption: string;
  /** The cut between the last advancing position and the first one below it. */
  pickCut: string;
  /** Announced on every row above the cut, so the line isn't the only thing that says it. */
  pickAdvancingRow: string;
  /** Names a row's reorder control. Both ways to sort belong in it, so both are named. */
  pickMoveRow: (participant: string) => string;
  /** Announced on a list whose order can no longer be changed. */
  pickLocked: string;
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
  pickCaption: 'Your predicted order',
  pickCut: 'Advancing',
  pickAdvancingRow: 'Advancing',
  pickMoveRow: (participant) => `Move ${participant}. Drag it, or use the arrow keys.`,
  pickLocked: 'This order can no longer be changed',
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
