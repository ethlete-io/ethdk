import { MatchListView, RoundListView } from '@ethlete/types';

export interface EthleteRound {
  id: string;
  displayName: string;
  number: number;
  state: string;
  bracket: 'winner' | 'looser' | null;
}

export interface BracketRound {
  matchCount: number;
  name: string;
  matches: BracketMatch[];
  data: EthleteRound;

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
  row: {
    start: number;
    end: number;
  };
  data: MatchListView;
  previousMatches: {
    roundId: string;
    matchIds: string[];
  } | null;

  nextMatch: {
    roundId: string;
    matchId: string;
  } | null;
}

// TODO(TRB): Remove this once provided by api
export interface RoundWithMatchesView {
  round: RoundListView & { bracket?: 'winner' | 'looser' | null };
  matches: MatchListView[];
}
