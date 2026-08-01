import { NormalizedMatchParticipant } from '../match';

/** One result in a participant's recent form. */
export type StandingsFormResult = 'win' | 'loss' | 'tie';

/**
 * One row of a table, in the shape `et-standings` draws. Same philosophy as the match domain: **every
 * backend maps into it** with a plain adapter, and the components never learn one API's field names.
 *
 * Deliberately the columns a league table has and nothing else - a competition with exotic tiebreakers
 * puts them in a table of its own.
 */
export type NormalizedStandingRow = {
  /** Stable identity, for tracking rows across updates. */
  id: string;
  /** Where the row sits, 1-based. Rows are drawn in the order given, not re-sorted. */
  position: number;
  /** Who it is. `null` renders the TBD placeholder, for a table published before the draw. */
  participant: NormalizedMatchParticipant | null;
  played: number;
  wins: number;
  ties: number;
  losses: number;
  /** What the table ranks by - points in most competitions, wins in some. */
  points: number;
  /** Goal or game difference, when the competition tracks one. */
  difference: number | null;
  /** Recent results, **oldest first**. `null` when the competition doesn't report form. */
  form: StandingsFormResult[] | null;
};

/**
 * A band of positions that means something: promotion, playoffs, relegation, advancing out of a group.
 *
 * `color` names one of **your** registered color themes - this library ships none and hardcodes none, so
 * what "advancing" looks like is your app's decision. The same config draws the row banding and the
 * legend, which is what stops the two from drifting apart.
 */
export type StandingsZone = {
  /** First position in the band, 1-based and inclusive. */
  from: number;
  /** Last position, inclusive. */
  to: number;
  /** A registered color theme name (or the theme object) the band is drawn in. */
  color: string;
  /** What the band means, for the legend. */
  label: string;
};
