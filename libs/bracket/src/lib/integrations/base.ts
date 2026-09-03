import { BracketMatchStatus, BracketRoundType, MatchParticipantSide, TournamentMode } from '../core';

export type BracketSlotSourceKind = 'match-outcome' | 'standing-rank' | 'seed' | 'swiss-bucket' | 'bye' | 'external';

export type BracketSlotSource = {
  kind: BracketSlotSourceKind;
  role: 'winner' | 'loser' | null;
  matchId: string | null;
  standingId: string | null;
  rank: number | null;
  label: string | null;
};

export type BracketMatchSlot = {
  participantId: string | null;
  source: BracketSlotSource | null;
};

export type BracketMatchSource<TMatchData> = {
  data: TMatchData;
  id: string;
  roundId: string;
  home: string | null;
  away: string | null;
  /** Where the home participant comes from. Omit for legacy sources that do not carry provenance. */
  homeSource?: BracketSlotSource | null;
  /** Where the away participant comes from. Omit for legacy sources that do not carry provenance. */
  awaySource?: BracketSlotSource | null;
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
