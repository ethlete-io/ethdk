import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import {
  MatchParticipantSide,
  NewBracketMatchParticipantWithRelationsBase,
  createNewMatchParticipantBase,
} from './match-participant';
import { MatchParticipantId, NewBracketParticipantWithRelationsBase } from './participant';
import { BracketRoundId, NewBracketRoundWithRelationsBase } from './round';

export type BracketMatchId = string & { __brand: 'BracketMatchId' };
export type BracketMatchShortId = string & { __brand: 'BracketMatchShortId' };
export type BracketMatchPosition = number & { __brand: 'BracketMatchPosition' };

export type BracketMatchStatus = 'completed' | 'pending';

export type NewBracketMatchBase<TMatchData> = {
  data: TMatchData;
  indexInRound: number;
  id: BracketMatchId;
  shortId: BracketMatchShortId;
  position: BracketMatchPosition;
  winnerSide: MatchParticipantSide | null;
  status: BracketMatchStatus;
};

export type NewBracketMatchWithRelationsBase<TMatchData> = NewBracketMatchBase<TMatchData> & {
  roundId: BracketRoundId;
  home: NewBracketMatchParticipantWithRelationsBase | null;
  away: NewBracketMatchParticipantWithRelationsBase | null;
  winner: NewBracketMatchParticipantWithRelationsBase | null;
};

export const createMatchesMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  rounds: BracketMap<BracketRoundId, NewBracketRoundWithRelationsBase<TRoundData>>,
  participants: BracketMap<MatchParticipantId, NewBracketParticipantWithRelationsBase>,
) => {
  const map: BracketMap<BracketMatchId, NewBracketMatchWithRelationsBase<TMatchData>> = new BracketMap();

  for (const match of source.matches) {
    const genericRound = rounds.get(match.roundId as BracketRoundId);
    const splitRound = rounds.get(`${match.roundId}--half-1` as BracketRoundId);
    const splitRound2 = rounds.get(`${match.roundId}--half-2` as BracketRoundId);

    const genericRoundMatchIndex = genericRound?.matchIds.indexOf(match.id as BracketMatchId) ?? -1;
    const splitRoundMatchIndex = splitRound?.matchIds.indexOf(match.id as BracketMatchId) ?? -1;
    const splitRound2MatchIndex = splitRound2?.matchIds.indexOf(match.id as BracketMatchId) ?? -1;

    const roundToUse =
      genericRoundMatchIndex !== -1
        ? genericRound
        : splitRoundMatchIndex !== -1
          ? splitRound
          : splitRound2MatchIndex !== -1
            ? splitRound2
            : null;

    if (!roundToUse) throw new Error(`Round for match with id ${match.id} not found`);

    const indexInRound =
      genericRoundMatchIndex !== -1
        ? genericRoundMatchIndex
        : splitRoundMatchIndex !== -1
          ? splitRoundMatchIndex
          : splitRound2MatchIndex !== -1
            ? splitRound2MatchIndex
            : -1;

    if (indexInRound === -1) throw new Error(`Match with id ${match.id} not found in round with id ${roundToUse.id}`);

    const home = createNewMatchParticipantBase(
      source,
      match.home as MatchParticipantId | null,
      match,
      rounds,
      roundToUse.id,
      participants,
    );
    const away = createNewMatchParticipantBase(
      source,
      match.away as MatchParticipantId | null,
      match,
      rounds,
      roundToUse.id,
      participants,
    );
    const winner = match.winner === 'home' ? home : match.winner === 'away' ? away : null;

    const matchBase: NewBracketMatchWithRelationsBase<TMatchData> = {
      home,
      away,
      data: match.data,
      shortId: `${roundToUse.shortId}-${indexInRound}` as BracketMatchShortId,
      id: match.id as BracketMatchId,
      indexInRound,
      position: (indexInRound + 1) as BracketMatchPosition,
      roundId: roundToUse?.id,
      status: match.status,
      winner,
      winnerSide: match.winner,
    };

    map.set(matchBase.id, matchBase);
  }

  return map;
};
