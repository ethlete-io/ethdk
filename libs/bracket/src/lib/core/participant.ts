import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketMatchId } from './match';

export type MatchParticipantId = string & { _brand: 'MatchParticipantId' };
export type MatchParticipantShortId = string & { _brand: 'MatchParticipantShortId' };

export type BracketParticipantBase = {
  id: MatchParticipantId;
  shortId: MatchParticipantShortId;
};

export type BracketParticipantWithRelationsBase = BracketParticipantBase & {
  matchIds: BracketMatchId[];
};

export const createParticipantsMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
) => {
  const map: BracketMap<MatchParticipantId, BracketParticipantWithRelationsBase> = new BracketMap();

  const participantIds = source.matches
    .map((m) => [m.home, m.away])
    .flat()
    .filter((p) => !!p) as MatchParticipantId[];

  const matchIdsByParticipant = new Map<string, BracketMatchId[]>();

  for (const match of source.matches) {
    for (const participantId of new Set([match.home, match.away])) {
      if (!participantId) continue;

      const matchIds = matchIdsByParticipant.get(participantId) ?? [];

      matchIds.push(match.id as BracketMatchId);
      matchIdsByParticipant.set(participantId, matchIds);
    }
  }

  for (const [index, participantId] of participantIds.entries()) {
    const participantBase: BracketParticipantWithRelationsBase = {
      id: participantId as MatchParticipantId,
      shortId: `p${index}` as MatchParticipantShortId,
      matchIds: matchIdsByParticipant.get(participantId) ?? [],
    };

    map.set(participantId, participantBase);
  }

  return map;
};
