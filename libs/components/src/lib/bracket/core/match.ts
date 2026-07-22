import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import {
  MatchParticipantSide,
  BracketMatchParticipantWithRelationsBase,
  createNewMatchParticipantBase,
} from './match-participant';
import { MatchParticipantId, BracketParticipantWithRelationsBase } from './participant';
import { BracketRoundId, BracketRoundWithRelationsBase } from './round';
import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type BracketMatchId = string & { _brand: 'BracketMatchId' };
export type BracketMatchShortId = string & { _brand: 'BracketMatchShortId' };
export type BracketMatchPosition = number & { _brand: 'BracketMatchPosition' };

export type BracketMatchStatus = 'completed' | 'pending';

export type BracketMatchBase<TMatchData> = {
  data: TMatchData;
  indexInRound: number;
  id: BracketMatchId;
  shortId: BracketMatchShortId;
  position: BracketMatchPosition;
  winnerSide: MatchParticipantSide | null;
  status: BracketMatchStatus;
};

export type BracketMatchWithRelationsBase<TMatchData> = BracketMatchBase<TMatchData> & {
  roundId: BracketRoundId;
  home: BracketMatchParticipantWithRelationsBase | null;
  away: BracketMatchParticipantWithRelationsBase | null;
  winner: BracketMatchParticipantWithRelationsBase | null;
};

export const createMatchesMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  rounds: BracketMap<BracketRoundId, BracketRoundWithRelationsBase<TRoundData>>,
  participants: BracketMap<MatchParticipantId, BracketParticipantWithRelationsBase>,
  // eslint-disable-next-line max-params -- builder threads the source plus its round and participant lookup maps
) => {
  const map: BracketMap<BracketMatchId, BracketMatchWithRelationsBase<TMatchData>> = new BracketMap();

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

    if (!roundToUse)
      throw new RuntimeError(
        BRACKET_ERROR_CODES.MATCH_RELATION_INVALID,
        `Round for match with id ${match.id} not found`,
      );

    const indexInRound =
      genericRoundMatchIndex !== -1
        ? genericRoundMatchIndex
        : splitRoundMatchIndex !== -1
          ? splitRoundMatchIndex
          : splitRound2MatchIndex !== -1
            ? splitRound2MatchIndex
            : -1;

    if (indexInRound === -1)
      throw new RuntimeError(
        BRACKET_ERROR_CODES.MATCH_RELATION_INVALID,
        `Match with id ${match.id} not found in round with id ${roundToUse.id}`,
      );

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

    const matchBase: BracketMatchWithRelationsBase<TMatchData> = {
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
