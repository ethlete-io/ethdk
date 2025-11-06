export const TOURNAMENT_MODE = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
  SWISS_WITH_ELIMINATION: 'swiss-with-elimination',
} as const;

export type TournamentMode = (typeof TOURNAMENT_MODE)[keyof typeof TOURNAMENT_MODE];
