export const BRACKET_ERROR_CODES = {
  /** The source has no rounds/matches to render. */
  SOURCE_EMPTY: 3401,
  /** An integration received a tournament mode it does not support. */
  MODE_UNSUPPORTED: 3402,
  /** Two rounds in the source share an id. */
  DUPLICATE_ROUND: 3403,
  /** Two matches in the source share an id. */
  DUPLICATE_MATCH: 3404,
  /** A round-to-round relation could not be resolved (malformed round structure). */
  ROUND_RELATION_INVALID: 3405,
  /** A match-to-match relation could not be resolved (match counts don't line up). */
  MATCH_RELATION_INVALID: 3406,
  /** The computed layout grid is in an inconsistent state. */
  GRID_INVALID: 3407,
  /** Swiss groups could not be generated from the source. */
  SWISS_GROUPING_FAILED: 3408,
  /** A Swiss group ended up without any matches while headers are enabled. */
  SWISS_GROUP_EMPTY: 3409,
  /** A match's resolved winner id is not among its participants. */
  WINNER_NOT_FOUND: 3410,
  /** A required key was missing from an internal bracket lookup map. */
  DATA_LOOKUP_FAILED: 3411,
  /** The default cards are rendering but no `matchNormalizer` was registered to feed them. */
  MISSING_MATCH_NORMALIZER: 3412,
  /** No registered {@link BracketLayout} matches the source's tournament `mode`. */
  LAYOUT_NOT_REGISTERED: 3413,
  /** A cell the bracket draws has no card - neither an input, the layout, nor the config names one. */
  CARD_NOT_REGISTERED: 3414,
  /** `createPlaceholderBracketSource` got a `participantCount` that is not a power of two, or too small for its mode. */
  PLACEHOLDER_SHAPE_INVALID: 3415,
} as const;
