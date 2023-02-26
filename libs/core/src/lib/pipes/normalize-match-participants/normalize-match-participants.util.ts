import { MatchListView } from '@ethlete/types';
import { MatchStateType, normalizeMatchState } from '../normalize-match-state';
import { NormalizedMatchParticipant, NormalizedMatchParticipants } from './normalize-match-participants.types';

export const normalizeMatchParticipants = (match: MatchListView | null): NormalizedMatchParticipants | null => {
  const matchState = normalizeMatchState(match);

  if (!match || !matchState) {
    return null;
  }

  return {
    home: normalizeMatchParticipant(match, 'home'),
    away: normalizeMatchParticipant(match, 'away'),
  };
};

export const normalizeMatchParticipant = (
  match: MatchListView | null,
  side: 'home' | 'away',
): NormalizedMatchParticipant | null => {
  const matchState = normalizeMatchState(match);

  if (!match || !matchState) {
    return null;
  }

  const participant = match[side];
  const participantType = match.home?.type ?? match.away?.type ?? 'unknown';

  if (!participant) {
    if (matchState === MatchStateType.POST_MATCH || matchState === MatchStateType.AUTO_WIN) {
      return {
        participantType,
        type: 'none',
        i18n: 'match-participant.none',
        text: 'No opponent',
        data: participant,
      };
    } else {
      return {
        participantType,
        type: 'tbd',
        i18n: 'match-participant.tbd',
        text: 'TBD',
        data: participant,
      };
    }
  } else {
    return {
      participantType,
      type: 'participant',
      data: participant,
    };
  }
};
