import { BracketMatchStatus, BracketRoundType, MatchParticipantSide, TournamentMode } from '../core';

export type BracketMatchSource<TMatchData> = {
  data: TMatchData;
  id: string;
  roundId: string;
  home: string | null;
  away: string | null;
  winner: MatchParticipantSide | null;
  status: BracketMatchStatus;
};

export type BracketDataSource<TRoundData, TMatchData> = {
  rounds: BracketRoundSource<TRoundData>[];
  matches: BracketMatchSource<TMatchData>[];
  mode: TournamentMode;
};

export type BracketRoundSource<TRoundData> = {
  type: BracketRoundType;
  id: string;
  data: TRoundData;
  name: string;
};
