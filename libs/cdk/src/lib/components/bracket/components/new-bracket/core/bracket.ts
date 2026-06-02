import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketDataLayout, canRenderLayoutInTournamentMode } from './layout';
import { BracketMatchId, NewBracketMatchWithRelationsBase, createMatchesMapBase } from './match';
import { MatchParticipantId, NewBracketParticipantWithRelationsBase, createParticipantsMapBase } from './participant';
import {
  BracketRoundId,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  NewBracketRoundWithRelationsBase,
  createRoundsMapBase,
} from './round';
import { TournamentMode } from './tournament';

export type NewBracketBase<TRoundData, TMatchData> = {
  rounds: BracketMap<BracketRoundId, NewBracketRoundWithRelationsBase<TRoundData>>;
  matches: BracketMap<BracketMatchId, NewBracketMatchWithRelationsBase<TMatchData>>;
  participants: BracketMap<MatchParticipantId, NewBracketParticipantWithRelationsBase>;
  mode: TournamentMode;
};

export type GenerateBracketDataOptions = {
  layout: BracketDataLayout;
};

const TERMINAL_ROUND_SORT_PRIORITY: Partial<Record<string, number>> = {
  [COMMON_BRACKET_ROUND_TYPE.FINAL]: 1,
  [DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL]: 2,
  [COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE]: 3,
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

export const createNewBracketBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  if (!canRenderLayoutInTournamentMode(options.layout, source.mode)) {
    throw new Error(`Cannot render layout ${options.layout} in mode ${source.mode}`);
  }

  const normalizedSource = sortSourceMatchesByRoundOrder(source);

  const participants = createParticipantsMapBase(normalizedSource);
  const rounds = createRoundsMapBase(normalizedSource, options);
  const matches = createMatchesMapBase(normalizedSource, rounds, participants);

  const bracketData: NewBracketBase<TRoundData, TMatchData> = {
    matches,
    rounds,
    participants,
    mode: source.mode,
  };

  return bracketData;
};
