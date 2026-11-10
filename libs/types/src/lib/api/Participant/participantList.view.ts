// Generated Interface, do not change manually!
import { MediaMinimalView } from './../Media/mediaMinimal.view';

export interface ParticipantListView {
    id: string;
    name: string;
    image: MediaMinimalView | null;
    type: string;
    profileType: string | null;
    profileId: string | null;
    number: number | null;
}

export default ParticipantListView;
