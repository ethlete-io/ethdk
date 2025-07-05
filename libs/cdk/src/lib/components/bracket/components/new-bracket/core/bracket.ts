import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketDataLayout, canRenderLayoutInTournamentMode } from './layout';
import { BracketMatchId, NewBracketMatchWithRelationsBase, createMatchesMapBase } from './match';
import { MatchParticipantId, NewBracketParticipantWithRelationsBase, createParticipantsMapBase } from './participant';
import { BracketRoundId, NewBracketRoundWithRelationsBase, createRoundsMapBase } from './round';
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

export const createNewBracketBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  if (!canRenderLayoutInTournamentMode(options.layout, source.mode)) {
    throw new Error(`Cannot render layout ${options.layout} in mode ${source.mode}`);
  }

  const participants = createParticipantsMapBase(source);
  const rounds = createRoundsMapBase(source, options);
  const matches = createMatchesMapBase(source, rounds, participants);

  const bracketData: NewBracketBase<TRoundData, TMatchData> = {
    matches,
    rounds,
    participants,
    mode: source.mode,
  };

  return bracketData;
};
