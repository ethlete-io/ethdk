import { ParticipantViewUnion } from '@ethlete/types';
import { Translatable } from '../../types';

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
