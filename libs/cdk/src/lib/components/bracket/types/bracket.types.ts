import { MatchListView, RoundStageStructureView } from '@ethlete/types';

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
