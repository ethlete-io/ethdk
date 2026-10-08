import { BracketMatchStatus, BracketRoundType, MatchParticipantSide, TournamentMode } from '../core';

export type BracketSlotSourceKind = BracketSlotSource['kind'];

type BracketSlotSourceShared = {
  /** Competition wording for the empty slot. The library never invents one. */
  label?: string | null;
  /** The seeding position this slot is reserved for. Optional - a source may carry no seeding at all. */
  seed?: number | null;
};

/** The winner or loser of an earlier match. */
export type BracketMatchOutcomeSlotSource = BracketSlotSourceShared & {
  kind: 'match-outcome';
  matchId: string;
  role: 'winner' | 'loser';
};

/** A position in a standing, such as "group A, 2nd". */
export type BracketStandingRankSlotSource = BracketSlotSourceShared & {
  kind: 'standing-rank';
  standingId: string;
  rank: number;
  /** What {@link standingId} is called, for a slot that has to be worded without a lookup. */
  standingName?: string | null;
};

export type BracketSeedSlotSource = BracketSlotSourceShared & { kind: 'seed' };

export type BracketSwissBucketSlotSource = BracketSlotSourceShared & { kind: 'swiss-bucket' };

export type BracketByeSlotSource = BracketSlotSourceShared & { kind: 'bye' };

export type BracketExternalSlotSource = BracketSlotSourceShared & { kind: 'external' };

/** Where the participant of a match side comes from, discriminated by `kind`. Build one with {@link bracketSlot}. */
export type BracketSlotSource =
  | BracketMatchOutcomeSlotSource
  | BracketStandingRankSlotSource
  | BracketSeedSlotSource
  | BracketSwissBucketSlotSource
  | BracketByeSlotSource
  | BracketExternalSlotSource;

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
