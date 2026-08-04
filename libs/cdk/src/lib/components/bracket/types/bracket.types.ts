import { MatchListView, RoundStageStructureView } from '@ethlete/types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketRound = {
  matchCount: number;
  name: string | null;
  matches: BracketMatch[];
  data: RoundStageStructureView;

  row: {
    start: number;
    end: number;
  };

  column: {
    start: number;
    end: number;
  };
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketMatch = {
  data: MatchListView;

  row: {
    start: number;
    end: number;
  };

  previousMatches: {
    roundId: string;
    matchIds: string[];
  } | null;

  nextMatch: {
    roundId: string;
    matchId: string;
  } | null;
};
