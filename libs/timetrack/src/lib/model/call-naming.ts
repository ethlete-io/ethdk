/**
 * How long a break between two calls still makes the earlier one the thing that ran *before* the
 * later one. Past it a call stands on its own, so a meeting in the morning cannot key an evening
 * call that merely happens to follow it in the day.
 */
export const DEFAULT_CALL_AFTER_GAP_MS = 30 * 60_000;

/** The boundaries, in minutes, that {@link callDurationBand} sorts a call's length into. */
const DURATION_BAND_MINUTES = [15, 30, 60, 120];

/**
 * The band a call's length falls in, as the label a settings list can show.
 *
 * A band rather than the length itself, because the same weekly call runs 22 minutes one week and 28
 * the next. A call that crosses a boundary between two weeks keys as a second record instead of
 * replacing the first, and both then match — see {@link matchCallNaming}, which takes the higher score.
 */
export const callDurationBand = (durationMs: number) => {
  const minutes = durationMs / 60_000;
  const index = DURATION_BAND_MINUTES.findIndex((boundary) => minutes < boundary);

  if (index === 0) return `0-${DURATION_BAND_MINUTES[0]}`;
  if (index < 0) return `${DURATION_BAND_MINUTES[DURATION_BAND_MINUTES.length - 1]}+`;

  return `${DURATION_BAND_MINUTES[index - 1]}-${DURATION_BAND_MINUTES[index]}`;
};

/**
 * What a call is recognised by when no calendar occurrence names it.
 *
 * `after` is the only feature that is a relation rather than a property, and it is the one that
 * describes a call with no fixed clock time — one that starts when the meeting before it ends. See
 * ADR 0012.
 */
export type CallFeatures = {
  /** The process that held the microphone, lowercased. */
  appId: string;
  /** The local weekday the call started on, 0 for Sunday. */
  weekday: number;
  /** From {@link callDurationBand}. */
  durationBand: string;
  /**
   * What ran immediately before it: the calendar series of the call before this one, or that call's
   * application when the calendar named none. Absent when nothing ran inside
   * {@link DEFAULT_CALL_AFTER_GAP_MS}.
   */
  after?: string;
  /** Minutes past local midnight. The tiebreak between two records that score the same, never a gate. */
  startMinute: number;
};

/** What the user answered when a call the calendar never held asked which issue it belongs to. */
export type CallNaming = CallFeatures & {
  issueKey: string;
  /** What the call read as when the answer was given, so a list of these reads as calls. */
  label: string;
  createdAt: Date;
};

/** The features of one call window. */
export const callFeaturesOf = (options: {
  appId: string;
  from: Date;
  to: Date;
  /** The `after` feature, already resolved by the caller from the call before this one. */
  after?: string;
}): CallFeatures => ({
  appId: options.appId.trim().toLowerCase(),
  weekday: options.from.getDay(),
  durationBand: callDurationBand(options.to.getTime() - options.from.getTime()),
  ...(options.after ? { after: options.after } : {}),
  startMinute: options.from.getHours() * 60 + options.from.getMinutes(),
});

/**
 * What a record replaces. The start minute is left out: a weekly call that starts four minutes late
 * is the same call, and a record per minute would never be answered twice.
 */
export const callNamingKey = (features: CallFeatures) =>
  [features.appId, features.weekday, features.durationBand, features.after ?? ''].join('|');

/** How well a remembered call naming fits a call, and how much the row may then claim. */
export type CallNamingMatch = {
  naming: CallNaming;
  match: 'likely' | 'weak';
};

const WEEKDAY_SCORE = 2;
const AFTER_SCORE = 3;
const BAND_SCORE = 1;
const CLOCK_SCORE = 2;

/** How far apart two starts may be and still read as the same time of day. */
const CLOSE_START_MINUTES = 30;

/**
 * A record needs more than one feature to agree before it names anything, so the weekday alone is
 * below the floor. `after` is worth most because it is the feature that survives a call with no fixed
 * time, and the duration band is worth least because it is the one that moves week to week.
 */
const LIKELY_SCORE = 4;
const WEAK_SCORE = 3;

const scoreOf = (options: { features: CallFeatures; naming: CallNaming }) => {
  const { features, naming } = options;
  const weekday = features.weekday === naming.weekday ? WEEKDAY_SCORE : 0;
  const after = naming.after ? AFTER_SCORE : 0;
  const band = features.durationBand === naming.durationBand ? BAND_SCORE : 0;
  const clock = Math.abs(features.startMinute - naming.startMinute) <= CLOSE_START_MINUTES ? CLOCK_SCORE : 0;

  return weekday + after + band + clock;
};

export const matchCallNaming = (options: {
  features: CallFeatures;
  namings: readonly CallNaming[];
}): CallNamingMatch | undefined => {
  const { features } = options;
  const scored = options.namings
    .filter((naming) => naming.appId === features.appId && (!naming.after || naming.after === features.after))
    .map((naming) => ({ naming, score: scoreOf({ features, naming }) }))
    .filter((entry) => entry.score >= WEAK_SCORE)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Math.abs(left.naming.startMinute - features.startMinute) -
          Math.abs(right.naming.startMinute - features.startMinute),
    );
  const best = scored[0];

  if (!best) return undefined;

  return { naming: best.naming, match: best.score >= LIKELY_SCORE ? 'likely' : 'weak' };
};

/**
 * The namings with this answer written in. An answer for features the store already holds replaces
 * that record, so the newest answer is the one that applies.
 */
export const rememberCallNaming = (options: {
  namings: readonly CallNaming[];
  features: CallFeatures;
  issueKey: string;
  label: string;
  at: Date;
}): CallNaming[] => {
  const written: CallNaming = {
    ...options.features,
    issueKey: options.issueKey.trim().toUpperCase(),
    label: options.label,
    createdAt: options.at,
  };
  const key = callNamingKey(options.features);

  return [...options.namings.filter((naming) => callNamingKey(naming) !== key), written];
};
