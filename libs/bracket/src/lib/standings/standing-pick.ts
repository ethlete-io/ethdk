/** How a group-table prediction scored on one position, once the real order is in. */
export const STANDING_PICK_OUTCOME = {
  /** The participant finished on exactly the predicted position. */
  EXACT: 'exact',
  /** They finished on the predicted side of the advancing line, on another position. */
  PARTIAL: 'partial',
  /** They finished on the other side of the advancing line. */
  WRONG: 'wrong',
} as const;

export type StandingPickOutcome = (typeof STANDING_PICK_OUTCOME)[keyof typeof STANDING_PICK_OUTCOME];

/**
 * How the participant predicted on `predictedPosition` scored, given where they really finished.
 *
 * `advancingCount` is how many positions advance, so a position is on the advancing side while it is
 * `<= advancingCount`. Ending up on the other side of that line is `WRONG` whatever the distance; the
 * predicted side of it is `EXACT` on the predicted position and `PARTIAL` on any other.
 *
 * `EXACT` is awarded below the line as well. An app whose API stores only the advancing positions holds no
 * prediction for the rest - the order there is whatever its UI happened to draw - and should narrow the
 * result to `PARTIAL`/`WRONG` itself for those positions.
 *
 * Returns the outcome and no points: what an outcome is worth is a rule of the competition, and
 * `POINTS[outcome]` is a lookup the app already owns.
 */
export const standingPickOutcome = (options: {
  /** The position the participant was predicted to finish on, 1-based. */
  predictedPosition: number;
  /** The position they really finished on, 1-based. */
  actualPosition: number;
  /** How many positions advance. */
  advancingCount: number;
}): StandingPickOutcome => {
  const { predictedPosition, actualPosition, advancingCount } = options;
  const predictedToAdvance = predictedPosition <= advancingCount;

  if (predictedToAdvance !== actualPosition <= advancingCount) return STANDING_PICK_OUTCOME.WRONG;
  if (predictedPosition === actualPosition) return STANDING_PICK_OUTCOME.EXACT;

  return STANDING_PICK_OUTCOME.PARTIAL;
};
