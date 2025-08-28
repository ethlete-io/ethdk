import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketMatchId } from './match';

export type MatchParticipantId = string & { __brand: 'MatchParticipantId' };
export type MatchParticipantShortId = string & { __brand: 'MatchParticipantShortId' };

export type NewBracketParticipantBase = {
  id: MatchParticipantId;
  shortId: MatchParticipantShortId;
};

export type NewBracketParticipantWithRelationsBase = NewBracketParticipantBase & {
  matchIds: BracketMatchId[];
};

export const createParticipantsMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
) => {
  const map: BracketMap<MatchParticipantId, NewBracketParticipantWithRelationsBase> = new BracketMap();

  const participantIds = new Set(
    source.matches
      .map((m) => [m.home, m.away])
      .flat()
      .filter((p) => !!p) as MatchParticipantId[],
  );

  for (const [index, participantId] of participantIds.entries()) {
    const participantBase: NewBracketParticipantWithRelationsBase = {
      id: participantId as MatchParticipantId,
      shortId: `p${index}` as MatchParticipantShortId,
      matchIds: source.matches
        .filter((m) => m.home === participantId || m.away === participantId)
        .map((m) => m.id as BracketMatchId),
    };

    map.set(participantId, participantBase);
  }

  return map;
};
