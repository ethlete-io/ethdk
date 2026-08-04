import { BracketMatchStatus, BracketRoundType, MatchParticipantSide, TournamentMode } from '../core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketMatchSource<TMatchData> = {
  data: TMatchData;
  id: string;
  roundId: string;
  home: string | null;
  away: string | null;
  winner: MatchParticipantSide | null;
  status: BracketMatchStatus;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketDataSource<TRoundData, TMatchData> = {
  rounds: BracketRoundSource<TRoundData>[];
  matches: BracketMatchSource<TMatchData>[];
  mode: TournamentMode;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketRoundSource<TRoundData> = {
  type: BracketRoundType;
  id: string;
  data: TRoundData;
  name: string;
};
