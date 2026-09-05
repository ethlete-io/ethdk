export const TOURNAMENT_MODE = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
  SWISS_WITH_ELIMINATION: 'swiss-with-elimination',
} as const;

export type TournamentMode = (typeof TOURNAMENT_MODE)[keyof typeof TOURNAMENT_MODE];

/** Wins that advance a participant out of a swiss stage. */
export const SWISS_ADVANCE_WINS = 3;

/** Losses that eliminate a participant from a swiss stage. */
export const SWISS_ELIMINATE_LOSSES = 3;
