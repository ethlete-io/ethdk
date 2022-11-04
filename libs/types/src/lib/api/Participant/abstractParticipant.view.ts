// Generated Interface, do not change manually!
import { ParticipantType } from './../Enum/Participant/participant.type';
import { MediaView } from './../Media/media.view';

export interface AbstractParticipantView {
    type: ParticipantType;
    id: string;
    name: string | null;
    slug: string | null;
    code: string | null;
    emblem: MediaView | null;
    nationality: string | null;
}

export default AbstractParticipantView;
