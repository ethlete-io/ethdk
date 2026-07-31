import { PictureSource } from '../picture';

/**
 * An image in the form `et-picture` consumes. Deliberately not a backend's media shape: an adapter
 * maps whatever the API returns into this, so the components never learn one API's field names.
 */
export type NormalizedMedia = {
  /** Candidate sources, as `et-picture`'s `sources` takes them. */
  sources?: (PictureSource | string)[];
  /** The fallback the browser uses when no source matches — and the whole image for a plain URL. */
  defaultSrc?: PictureSource | string | null;
};

/** One side of a match: a team, a player, a club. `null` on a match stands for a TBD slot. */
export type NormalizedMatchParticipant = {
  id: string;
  /** Display name — team name, gamertag. `null` when the API has none yet. */
  name: string | null;
  /** Short code for compact rendering (`'FCB'`). Falls back to `name` when absent. */
  code: string | null;
  /** The emblem/avatar. */
  emblem: NormalizedMedia | null;
  /** Seeding position, when the competition has one. */
  seed: number | null;
};

/**
 * How far along a match is. Three states, because that is what presentation turns on — an API's
 * richer lifecycle (`preparing`/`published`/`hidden`/…) is the adapter's to collapse.
 */
export type NormalizedMatchStatus = 'scheduled' | 'live' | 'finished';

/** One game of a series (a map, a leg), as its two scores. */
export type NormalizedGameScore = {
  home: number;
  away: number;
};

/**
 * A match, in the shape this library's match components render. **Every backend maps into it** — the
 * `@ethlete/types` adapter in `integrations/` is the first-class example, not the model. Keep an
 * adapter of your own to this shape and everything here works; anything more exotic belongs in a card
 * of your own.
 *
 * Deliberately presentation-oriented and minimal: what a card draws, and nothing else.
 */
export type NormalizedMatch = {
  id: string;
  status: NormalizedMatchStatus;
  /** Kick-off. `null` when unscheduled — the card then shows neither a time nor a countdown. */
  startTime: Date | null;
  /** The two sides. `null` is a TBD slot: a bracket match whose feeder hasn't finished. */
  home: NormalizedMatchParticipant | null;
  away: NormalizedMatchParticipant | null;
  /** The headline score. `null` before there is one — a scheduled match shows its start time instead. */
  homeScore: number | null;
  awayScore: number | null;
  /** Per-game scores of a series (Bo3/Bo5). `null` for a single game. */
  gameScores: NormalizedGameScore[] | null;
  /** Who won, once it is decided. `null` while undecided or drawn. */
  winnerSide: 'home' | 'away' | null;
  /** Free text naming this match — `'Match 3'`, `'Grand Final'`. */
  label: string | null;
};
