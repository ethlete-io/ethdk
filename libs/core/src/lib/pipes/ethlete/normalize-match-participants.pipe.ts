import { Pipe, PipeTransform } from '@angular/core';
import { MatchListView, ParticipantViewUnion } from '@ethlete/types';
import { Translatable } from '../../utils';
import { MatchStateType } from './normalize-match-score.pipe';
import { normalizeMatchState } from './normalize-match-state.pipe';

@Pipe({ name: 'etNormalizeMatchParticipants' })
export class NormalizeMatchParticipantsPipe implements PipeTransform {
  transform = normalizeMatchParticipants;
}

export interface NormalizedMatchParticipants {
  home: NormalizedMatchParticipant | null;
  away: NormalizedMatchParticipant | null;
}

type NormalizedParticipantType = 'team' | 'player' | 'unknown';

export type NormalizedMatchParticipant =
  | ({
      type: 'tbd';
      participantType: NormalizedParticipantType;
      data: ParticipantViewUnion | null;
    } & Translatable)
  | {
      type: 'participant';
      participantType: NormalizedParticipantType;
      data: ParticipantViewUnion;
    }
  | ({
      type: 'none';
      participantType: NormalizedParticipantType;
      data: ParticipantViewUnion | null;
    } & Translatable);

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
