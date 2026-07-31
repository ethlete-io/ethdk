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
  /**
   * A quieter second line under the name: the org behind an esports roster, the club behind a squad,
   * the region behind a player. `null` for the common one-line case, and never drawn in a dense row —
   * a bracket column has no space for it.
   */
  subtitle: string | null;
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
 * How a competition reports its results — and therefore the **one** thing a card draws for each side.
 * Never two of them: a cell showing `2` and `W` next to each other says the same thing twice.
 *
 * - `score` — goals, rounds, or games won in a series: `2` and `1`. From `homeScore`/`awayScore`.
 * - `points` — what the match is worth in a table: `3` and `0`, or `1` each for a draw. Same two fields.
 * - `outcome` — a win, a loss, a draw: `W`, `L`, `D`. **Derived from `winnerSide`**, so `homeScore` and
 *   `awayScore` are ignored and a consumer never denormalizes a result into two letters. It also means a
 *   screen reader hears "FC Berlin won" rather than the letter "W".
 */
export type NormalizedMatchResultKind = 'score' | 'points' | 'outcome';

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
  /**
   * The headline value each side shows, drawn as-is: goals, rounds, games won in a series, or table
   * points — say which in {@link resultKind}. A string is allowed for an API that reports something else
   * entirely (`'—'`, `'1.5'`). `null` when there is none, which is when the card shows the kick-off
   * instead. Both are **ignored** for `resultKind: 'outcome'`, which draws W/L/D off `winnerSide`.
   */
  homeScore: number | string | null;
  awayScore: number | string | null;
  /** Which of the three result forms this match reports — exactly one of them. */
  resultKind: NormalizedMatchResultKind;
  /**
   * Per-game scores, in order. A best-of-N match has up to N of them (Bo3, Bo5, Bo7 — the map or leg
   * scores that add up to the headline result). `null` for a single-game match, whose one game score
   * *is* the headline result and would only be repeated by listing it.
   */
  gameScores: NormalizedGameScore[] | null;
  /** Who won, once it is decided. `null` while undecided or drawn. */
  winnerSide: 'home' | 'away' | null;
  /** Free text naming this match — `'Match 3'`, `'Grand Final'`. */
  label: string | null;
};
