// Generated Interface, do not change manually!
import { CountryView } from './../Country/country.view';
import { ParticipantType } from './../Enum/Participant/participant.type';
import { MediaView } from './../Media/media.view';

export interface AbstractParticipantView {
    type: ParticipantType;
    id: string;
    name: string | null;
    slug: string | null;
    code: string | null;
    emblem: MediaView | null;
    countryOfResidence: CountryView | null;
    countryOfRepresentation: CountryView | null;
}

export default AbstractParticipantView;
