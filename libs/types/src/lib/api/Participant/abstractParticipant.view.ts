// Generated Interface, do not change manually!
import { ParticipantType } from './../Enum/Participant/participant.type';
import { MediaView } from './../Media/media.view';

export interface AbstractParticipantView {
    id: string;
    name: string | null;
    slug: string | null;
    type: ParticipantType;
    code: string | null;
    emblem: MediaView | null;
    nationality: string | null;
}

export default AbstractParticipantView;
