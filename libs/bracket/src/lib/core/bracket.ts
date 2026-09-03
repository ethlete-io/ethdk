import { BracketDataSource, BracketMatchSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketDataLayout } from './layout';
import { BracketMatchId, BracketMatchWithRelationsBase, createMatchesMapBase } from './match';
import { BracketParticipantWithRelationsBase, createParticipantsMapBase, MatchParticipantId } from './participant';
import { BracketRoundId, BracketRoundWithRelationsBase, createRoundsMapBase } from './round';
import { TournamentMode } from './tournament';

export type BracketBase<TRoundData, TMatchData> = {
  rounds: BracketMap<BracketRoundId, BracketRoundWithRelationsBase<TRoundData>>;
  matches: BracketMap<BracketMatchId, BracketMatchWithRelationsBase<TMatchData>>;
  participants: BracketMap<MatchParticipantId, BracketParticipantWithRelationsBase>;
  mode: TournamentMode;
};

export type GenerateBracketDataOptions = {
  layout: BracketDataLayout;
};

export type CreateBracketOptions<TMatchData> = GenerateBracketDataOptions & {
  /** The matches feeding this one, upper arm first. Slot provenance is used when omitted. */
  previousMatchIds?: (match: BracketMatchSource<TMatchData>) => string[];
};

const TERMINAL_ROUND_SORT_PRIORITY: Partial<Record<string, number>> = {
  final: 1,
  'reverse-final': 2,
  'third-place': 3,
};

const sortSourceMatchesByRoundOrder = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
): BracketDataSource<TRoundData, TMatchData> => {
  const orderedRoundIds = [...source.rounds]
    .sort((a, b) => (TERMINAL_ROUND_SORT_PRIORITY[a.type] ?? 0) - (TERMINAL_ROUND_SORT_PRIORITY[b.type] ?? 0))
    .map((r) => r.id);

  const roundIndexMap = new Map(orderedRoundIds.map((id, i) => [id, i]));

  const sortedMatches = [...source.matches].sort(
    (a, b) => (roundIndexMap.get(a.roundId) ?? 0) - (roundIndexMap.get(b.roundId) ?? 0),
  );

  return { ...source, matches: sortedMatches };
};

export const createBracketBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  const normalizedSource = sortSourceMatchesByRoundOrder(source);

  const participants = createParticipantsMapBase(normalizedSource);
  const rounds = createRoundsMapBase(normalizedSource, options);
  const matches = createMatchesMapBase(normalizedSource, rounds, participants);

  const bracketData: BracketBase<TRoundData, TMatchData> = {
    matches,
    rounds,
    participants,
    mode: source.mode,
  };

  return bracketData;
};
