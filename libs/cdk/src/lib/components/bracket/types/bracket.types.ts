import { MatchListView, RoundStageStructureView } from '@ethlete/types';

export interface BracketRound {
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
}

export interface BracketMatch {
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
}
